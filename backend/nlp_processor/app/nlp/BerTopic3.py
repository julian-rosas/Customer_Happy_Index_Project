# ====================================================
# BERTopic sobre embeddings pre-calculados con tweet representativo y traducciones
# ====================================================
import numpy as np
import pandas as pd
from bertopic import BERTopic
from googletrans import Translator

# -------------------------------
# Configuración
# -------------------------------
ARCHIVO_TWEETS = "tweets_limpios_completos.csv"
ARCHIVO_EMBEDDINGS = "embeddings_multilingue.npy"
ARCHIVO_BERTOPIC = "tweets_bertopic.csv"
NUM_KEYWORDS = 8  # Número de palabras clave a mostrar por topic

# -------------------------------
# Paso 1: Cargar tweets
# -------------------------------
df = pd.read_csv(ARCHIVO_TWEETS, low_memory=False)
df = df[df["Tweet_limpio"].notna() & (df["Tweet_limpio"] != "")].reset_index(drop=True)
tweets = df["Tweet_limpio"].tolist()
print(f"✅ {len(tweets)} tweets cargados.")

# -------------------------------
# Paso 2: Cargar embeddings
# -------------------------------
embeddings = np.load(ARCHIVO_EMBEDDINGS)
print(f"✅ {len(embeddings)} embeddings cargados.")

# -------------------------------
# Paso 3: Inicializar BERTopic
# -------------------------------
topic_model = BERTopic(
    language="multilingual",
    calculate_probabilities=True,
    verbose=True,
    min_topic_size=20
)

# -------------------------------
# Paso 4: Ajustar modelo con embeddings
# -------------------------------
topics, probs = topic_model.fit_transform(tweets, embeddings)
print("📝 Topics generados.")

# -------------------------------
# Paso 5: Contar número de topics distintos
# -------------------------------
num_topics = len(set(topics)) - (1 if -1 in topics else 0)
print(f"📊 BERTopic generó {num_topics} topics (excluyendo outliers).")

# -------------------------------
# Paso 6: Traducir palabras clave de los topics
# -------------------------------
translator = Translator()
topic_info = topic_model.get_topic_info()
real_topics = topic_info[topic_info.Topic != -1].reset_index(drop=True)

topic_translations = {}

print(f"\n🔑 Primeros {min(NUM_KEYWORDS, len(real_topics))} topics y sus palabras clave:")

for i, topic_id in enumerate(real_topics.Topic[:NUM_KEYWORDS]):
    keywords = topic_model.get_topic(topic_id)
    words = [k[0] for k in keywords]
    
    translations = []
    for word in words:
        try:
            t = translator.translate(word, src='auto', dest='en').text
        except Exception:
            t = word  # Si falla, dejar la palabra original
        translations.append(t)
    
    topic_translations[topic_id] = translations
    
    print(f"\nTema {topic_id}: {words}")
    print(f"🔤 Traducción al inglés: {translations}")

# -------------------------------
# Paso 7: Agregar topics y probabilidades al dataframe
# -------------------------------
df["BERTopic_Topic"] = topics
df["BERTopic_Prob"] = [p.max() if p is not None else None for p in probs]
df["BERTopic_Translated_Keywords"] = df["BERTopic_Topic"].map(topic_translations)

# -------------------------------
# Paso 8: Obtener tweet más representativo por topic usando Tweet_Limpio_Bruto
# -------------------------------
representative_tweets = {}
representative_tweets_en = {}

for topic_id in real_topics.Topic:
    rep_docs = topic_model.get_representative_docs(topic_id)
    if rep_docs:
        # Buscar el primer tweet representativo que exista en Tweet_Limpio_Bruto
        for doc in rep_docs:
            mask = df["Tweet_limpio"] == doc
            if mask.any():
                tweet_bruto = df.loc[mask, "Tweet_Limpio_Bruto"].iloc[0]
                representative_tweets[topic_id] = tweet_bruto
                # Traducir al inglés SOLO este tweet representativo con try/except
                try:
                    representative_tweets_en[topic_id] = translator.translate(tweet_bruto, src='auto', dest='en').text
                except Exception:
                    representative_tweets_en[topic_id] = tweet_bruto
                break

df["BERTopic_Representative_Tweet"] = df["BERTopic_Topic"].map(representative_tweets)
df["BERTopic_Representative_Tweet_En"] = df["BERTopic_Topic"].map(representative_tweets_en)

# -------------------------------
# Paso 9: Guardar resultados finales
# -------------------------------
df.to_csv(ARCHIVO_BERTOPIC, index=False, encoding="utf-8-sig")
print(f"✅ Resultados guardados en {ARCHIVO_BERTOPIC} con tweets representativos y traducción al inglés.")
