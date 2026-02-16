export interface Embedder {
  dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

export class LocalEmbedder implements Embedder {
  readonly dimension = 384;
  private pipeline: any = null;

  private async getPipeline() {
    if (!this.pipeline) {
      const { pipeline } = await import("@huggingface/transformers");
      this.pipeline = await pipeline("feature-extraction", "Xenova/gte-small", {
        dtype: "fp32",
      });
    }
    return this.pipeline;
  }

  async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return new Float32Array(output.data);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Sequential: ONNX runtime is single-threaded, batching doesn't help
    // and risks OOM on large inputs with variable-length texts.
    const pipe = await this.getPipeline();
    const results: Float32Array[] = [];
    for (const text of texts) {
      const output = await pipe(text, { pooling: "mean", normalize: true });
      results.push(new Float32Array(output.data));
    }
    return results;
  }
}

export class OpenAIEmbedder implements Embedder {
  readonly dimension = 1536;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("OpenAI API key is required");
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<Float32Array> {
    const results = await this.callApi([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // OpenAI supports batch in a single request (up to 2048 inputs)
    const batchSize = 512;
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.callApi(batch);
      results.push(...batchResults);
    }
    return results;
  }

  private async callApi(inputs: string[]): Promise<Float32Array[]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: inputs,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${body}`);
    }
    const json = (await resp.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    // Sort by index to preserve input order
    const sorted = json.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => new Float32Array(d.embedding));
  }
}

export function createEmbedder(provider: "local" | "openai", openaiKey?: string): Embedder {
  if (provider === "openai") {
    const key = openaiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API key required. Set OPENAI_API_KEY env var or run: kex-mem config set openai-key <key>");
    return new OpenAIEmbedder(key);
  }
  return new LocalEmbedder();
}
