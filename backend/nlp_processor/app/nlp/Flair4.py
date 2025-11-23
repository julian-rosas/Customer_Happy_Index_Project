# Map text references to geo coordinates
# ==========================================================
# Procesamiento de tweets: NER multilingüe + Sentiment
# ==========================================================

import pandas as pd
from flair.data import Sentence
from flair.models import SequenceTagger
from flair.nn import Classifier

# -------------------------------
# 1. Configuración
# -------------------------------
csv_input = "tweets_bertopic.csv"
csv_output = "tweets_limpios_completos_ner_sentiment.csv"

# Modelos NER
tagger_es = SequenceTagger.load("flair/ner-spanish-large")
tagger_de = SequenceTagger.load("de-ner-large")

# Modelo de Sentimiento
sentiment_model = Classifier.load('sentiment')

# -------------------------------
# 2. Cargar CSV
# -------------------------------
df = pd.read_csv(csv_input)

# -------------------------------
# 3. Iterar sobre tweets
# -------------------------------
locations = []
sentiment_scores = []

for i, row in df.iterrows():
    text = row["Procesado"]
    lang = row["Lang"]

    # -----------------------
    # NER
    # -----------------------
    sentence = Sentence(text)
    if lang.upper() == "E":
        tagger_es.predict(sentence)
    else:
        tagger_de.predict(sentence)

    # Extraer solo LOC
    loc_entities = [entity.text for entity in sentence.get_spans('ner') if entity.get_label('ner').value == "LOC"]
    locations.append(", ".join(loc_entities))

    # -----------------------
    # Sentimiento
    # -----------------------
    sentiment_sentence = Sentence(text)
    sentiment_model.predict(sentiment_sentence)
    label = sentiment_sentence.labels[0].value
    score = sentiment_sentence.labels[0].score
    if label == "NEGATIVE":
        score = -score  # negativo si la etiqueta es negativa
    sentiment_scores.append(score)

# -------------------------------
# 4. Añadir resultados al DataFrame
# -------------------------------
df["Locations"] = locations
df["SentimentScore"] = sentiment_scores

# -------------------------------
# 5. Guardar CSV final
# -------------------------------
df.to_csv(csv_output, index=False)
print(f"Procesamiento completado. CSV guardado en: {csv_output}")
