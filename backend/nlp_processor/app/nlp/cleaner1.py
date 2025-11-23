import pandas as pd
import re
import spacy
from collections import Counter
from gensim.models.phrases import Phrases, Phraser

# ============================
# Cargar datos
# ============================
df = pd.read_csv(r"D:\Customer_Happy_Index_Project\backend\nlp_processor\app\nlp\Data\tweets_format.csv")

# ============================
# MODELOS POR IDIOMA
# ============================
nlp_es = spacy.load("es_core_news_sm")
nlp_de = spacy.load("de_core_news_sm")

# ============================
# STOPWORDS
# ============================
FRASES_A_ELIMINAR = ["rt", "via"]

STOP_ES = set(nlp_es.Defaults.stop_words).union([x.lower() for x in FRASES_A_ELIMINAR])
STOP_DE = set(nlp_de.Defaults.stop_words).union([x.lower() for x in FRASES_A_ELIMINAR])

# ============================
# ALIAS
# ============================
ALIAS = {
    "cdmx": "ciudad_de_mexico",
}

# ============================
# 1) Limpieza básica
# ============================
def limpiar_bruto(t):
    if pd.isna(t):
        return ""

    t = re.sub(r'^.*?@\w+.*?\b\d+\s*[mhsMHHS]\b', '', t, flags=re.DOTALL)
    t = re.sub(r'Replying to\s*@\w+', '', t, flags=re.IGNORECASE)
    t = re.sub(r'^Replying to$', '', t, flags=re.MULTILINE | re.IGNORECASE)

    # URLs
    t = re.sub(r'https?://\S+|www\.\S+', '', t)

    # menciones/hashtags
    t = re.sub(r'[@#]\w+', '', t)

    # líneas de solo números
    t = re.sub(r'^\s*\d+\s*$', '', t, flags=re.MULTILINE)

    # caracteres no alfanuméricos
    t = re.sub(r'[^A-Za-zÀ-ÿ0-9\s]', ' ', t)

    t = t.lower()
    t = re.sub(r'\s+', ' ', t).strip()

    return t

# Aplicar limpieza básica y guardar en columna separada
df["Tweet_Limpio_Bruto"] = df["Tweet"].apply(limpiar_bruto)

# Ahora sí, reemplazar "Tweet" por la columna que seguiremos procesando
df["Tweet_limpio"] = df["Tweet_Limpio_Bruto"]

# Eliminar columna original si quieres
df = df.drop(columns=["Tweet"])

# ============================
# 2) Menciones y hashtags
# ============================
def extraer_menciones_hashtags(texto):
    menciones = re.findall(r"@(\w+)", texto)
    hashtags = re.findall(r"#(\w+)", texto)

    menciones_counter = Counter([m.lower() for m in menciones])
    hashtags_counter = Counter([h.lower() for h in hashtags])

    if menciones_counter:
        mas_mencionado = menciones_counter.most_common(1)[0][0]
        del menciones_counter[mas_mencionado]

    return menciones_counter, hashtags_counter

# ============================
# 3) Alias
# ============================
def unificar_alias(texto):
    for alias, nombre in ALIAS.items():
        texto = re.sub(rf"\b{alias}\b", nombre, texto)
    return texto

df["Tweet_limpio"] = df["Tweet_limpio"].apply(unificar_alias)

# ============================
# 4) spaCy: stopwords, entidades, lematizar + infinitivo para verbos
# ============================
def procesar_spacy(texto, lang):

    if lang == "E":
        nlp = nlp_es
        STOP = STOP_ES
    elif lang == "A":
        nlp = nlp_de
        STOP = STOP_DE
    else:
        return ""

    doc = nlp(texto)

    # unir entidades de varias palabras con _
    texto_mod = texto
    for ent in doc.ents:
        if len(ent.text.split()) > 1:
            unido = "_".join(ent.text.split())
            texto_mod = texto_mod.replace(ent.text, unido)

    doc = nlp(texto_mod)

    tokens_limpios = []
    for token in doc:
        if token.is_stop or token.is_punct or token.like_url or token.like_email:
            continue
        if token.like_num:
            continue
        if len(token.lemma_) < 3:
            continue

        lemma = token.lemma_.lower().strip()
        if lemma in STOP:
            continue

        # VERBOS en infinitivo
        if token.pos_ == "VERB":
            tokens_limpios.append(lemma)  # spaCy devuelve el infinitivo
        else:
            tokens_limpios.append(lemma)

    return " ".join(tokens_limpios)

df["Procesado"] = df.apply(lambda x: procesar_spacy(x["Tweet_limpio"], x["Lang"]), axis=1)

# ============================
# 5) BIGRAMAS → reemplazar Tweet_limpio
# ============================
def detectar_bigramas(df, columna="Procesado", min_count=5, threshold=10):
    textos = [t.split() for t in df[columna] if isinstance(t, str)]
    phrases = Phrases(textos, min_count=min_count, threshold=threshold)
    bigram_mod = Phraser(phrases)

    nuevos = [" ".join(bigram_mod[t]) for t in textos]
    df["Tweet_limpio"] = nuevos   
    return df

df = detectar_bigramas(df)

# ============================
# Limpiar "and" al inicio o final
# ============================
df["Tweet_limpio"] = df["Tweet_limpio"].str.strip()
df["Tweet_limpio"] = df["Tweet_limpio"].str.replace(r'^(and\s+)|(\s+and)$', '', regex=True)

# ============================
# Guardar salida final
# ============================
# ============================
# Marcar fuente
# ============================
df["Fuente"] = ["C" if i < 5000 else "T" for i in range(len(df))]

df.to_csv("tweets_limpios_completos.csv", index=False, encoding='utf-8-sig')

print("✓ Limpieza completa aplicada (ES + DE) con infinitivos y bigramas en Tweet_limpio. Fuente marcada.")
