# Embedding generation + HDBSCAN clustering - pipeline completo
import os
import pandas as pd
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from umap import UMAP
import hdbscan

print(torch.cuda.is_available())      # Debería imprimir True
print(torch.cuda.device_count())      # Número de GPUs disponibles
print(torch.cuda.get_device_name(0))  # Nombre de la primera GPU


# -------------------------------
# Configuración
# -------------------------------
DEFAULT_MODELO = "paraphrase-multilingual-MiniLM-L12-v2"  # SBERT multilingüe
ARCHIVO_TWEETS = "tweets_limpios_completos.csv"
ARCHIVO_EMBEDDINGS = "embeddings_multilingue.npy"


# -------------------------------
# Paso 1: Cargar tweets
# -------------------------------
def cargar_tweets(archivo):
    if not os.path.exists(archivo):
        raise FileNotFoundError(f"❌ No se encontró el archivo {archivo}")
    
    df = pd.read_csv(archivo, low_memory=False)
    df = df[df["Tweet_limpio"].notna() & (df["Tweet_limpio"] != "")].reset_index(drop=True)
    print(f"✅ {len(df)} tweets cargados.")
    return df

# -------------------------------
# Paso 2: Obtener embeddings con SBERT
# -------------------------------
def obtener_embeddings(tweets, modelo_nombre=DEFAULT_MODELO, archivo_salida=None):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"🧠 Generando embeddings con SBERT ({modelo_nombre}) en {device.upper()}...")
    modelo = SentenceTransformer(modelo_nombre, device=device)
    embeddings = modelo.encode(tweets, show_progress_bar=True)

    if archivo_salida:
        np.save(archivo_salida, embeddings)
        print(f"💾 Embeddings guardados en {archivo_salida}")
    
    return embeddings

# -------------------------------
# Paso 3: Normalizar embeddings
# -------------------------------
def normalizar_embeddings(embeddings):
    embeddings = np.array(embeddings)
    if embeddings.ndim == 1:
        embeddings = embeddings.reshape(1, -1)
    
    Xnorm = np.linalg.norm(embeddings, axis=1, keepdims=True)
    Xnormed = embeddings / Xnorm
    print("🧪 Embeddings normalizados.")
    return Xnormed

# -------------------------------
# Paso 4: Reducir con UMAP
# -------------------------------
def reducir_umap(embeddings, n_components=20, n_neighbors=30, min_dist=0.1):
    print("🔻 Aplicando UMAP para reducción de dimensionalidad...")
    umap_model = UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric='cosine'
    )
    reducidos = umap_model.fit_transform(embeddings)
    print(f"📉 Embeddings reducidos a {n_components} dimensiones.")
    return reducidos



# -------------------------------
# Ejecución del pipeline completo
# -------------------------------
if __name__ == "__main__":
    # Cargar tweets
    df = cargar_tweets(ARCHIVO_TWEETS)
    tweets = df["Tweet_limpio"].tolist()

    # Generar embeddings
    embeddings = obtener_embeddings(tweets, archivo_salida=ARCHIVO_EMBEDDINGS)

    # Normalizar
    embeddings_norm = normalizar_embeddings(embeddings)

    # Reducir con UMAP
    embeddings_umap = reducir_umap(embeddings_norm)

