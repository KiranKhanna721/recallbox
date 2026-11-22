/** Seed content for "Load demo notes". `key` makes seeding idempotent per user. */
export interface DemoNote {
  key: string
  title: string
  content: string
}

export const DEMO_NOTES: DemoNote[] = [
  {
    key: 'vector-databases',
    title: 'Introduction to Vector Databases',
    content: `A vector database stores data as high-dimensional numeric vectors called embeddings and retrieves items by similarity instead of exact matching. An embedding model turns text, images or audio into a vector (often 384 to 3072 dimensions) where semantically similar inputs land close together.

How vector databases work: when you insert a document, you store its embedding alongside metadata such as the source id, title and tags. At query time the question is embedded with the same model, and the database returns the k nearest vectors using a distance metric — cosine similarity, dot product, or Euclidean (L2) distance. Cosine similarity is the most common choice for text embeddings because it ignores vector length.

Exact nearest-neighbour search compares the query against every vector, which is O(n) and too slow at millions of items. Vector databases therefore use approximate nearest neighbour (ANN) indexes. HNSW (Hierarchical Navigable Small World) builds a layered graph that is fast and accurate but memory-heavy. IVF (inverted file) clusters vectors and searches only the closest clusters. Product quantization (PQ) compresses vectors to save memory at some cost in recall.

Practical concerns: choose chunk sizes carefully (roughly 200–800 tokens per chunk is typical), keep metadata for filtering (for example user id or document type), and re-embed content when you change embedding models because vectors from different models are not comparable. Hybrid search combines vector similarity with keyword scoring such as BM25 to catch exact terms like product names or error codes.

Popular options include Pinecone, Weaviate, Qdrant, Milvus, Chroma, pgvector for Postgres, and Cloudflare Vectorize.`,
  },
  {
    key: 'react-hooks',
    title: 'React Hooks and Component Patterns',
    content: `Hooks let function components hold state and side effects. useState stores local state; calling the setter schedules a re-render. useReducer is better when the next state depends on complex transitions. useEffect synchronizes a component with something outside React (subscriptions, timers, network) and its cleanup function runs before the next effect and on unmount. The dependency array must list every reactive value the effect reads.

useMemo caches an expensive computed value and useCallback caches a function identity between renders; both are performance tools, not correctness tools, and should be added when profiling shows a need. useRef holds a mutable value that does not trigger re-renders and is the standard way to reference DOM nodes. useContext reads a value from the nearest provider and avoids prop drilling.

Rules of hooks: only call hooks at the top level of a component or custom hook — never inside loops, conditions or nested functions — so React can match hook calls to state slots by order. Custom hooks (functions named useSomething) extract reusable stateful logic, such as useDebounce or useLocalStorage.

Component patterns: prefer composition with children over deep configuration props. Keep state as close as possible to where it is used and lift it up only when siblings need to share it. Controlled components keep form values in React state; uncontrolled components read them from the DOM via refs. Derive values during render instead of copying props into state. Split container logic (data fetching) from presentational components to keep UI pieces reusable and easy to test.`,
  },
  {
    key: 'api-auth',
    title: 'API Authentication Best Practices',
    content: `Best practices for API authentication start with always using HTTPS so credentials and tokens are never sent in plaintext. Never put secrets or tokens in URLs or query strings, because URLs end up in logs, browser history and referrer headers; send them in the Authorization header instead.

Prefer short-lived access tokens, such as JWTs that expire in 5–15 minutes, paired with longer-lived refresh tokens that can be revoked. Validate every JWT on the server: check the signature with the issuer's public key, and verify the exp, iss and aud claims. Never trust identity claims sent by the client in a body or custom header — derive the user id from the verified token.

For third-party and user sign-in, use OAuth 2.0 with OpenID Connect rather than building password storage yourself. Browser apps should use the Authorization Code flow with PKCE. If you must store passwords, hash them with a slow algorithm such as Argon2id or bcrypt.

API keys are suitable for server-to-server calls but should be scoped to the minimum permissions, rotated regularly, stored in a secrets manager rather than source code, and never shipped to the browser. Apply the principle of least privilege and check authorization (who may access which resource) on every request, not just authentication — broken object-level authorization is the top OWASP API risk.

Add rate limiting and account lockout to slow brute-force attacks, log authentication events for auditing, and return generic error messages that do not reveal whether a username exists. When using cookies for sessions, set HttpOnly, Secure and SameSite attributes to reduce XSS and CSRF risk.`,
  },
  {
    key: 'rag',
    title: 'Retrieval-Augmented Generation',
    content: `Retrieval-augmented generation (RAG) is a technique that improves a large language model's answers by first retrieving relevant documents from an external knowledge source and then giving those documents to the model as context when it generates a response. Instead of relying only on what the model memorized during training, the answer is grounded in specific, up-to-date source material.

A RAG pipeline has three stages. Indexing: documents are split into chunks and stored in a searchable index — a keyword index such as BM25, a vector database of embeddings, or both (hybrid search). Retrieval: the user's question is used to find the top-k most relevant chunks. Generation: the retrieved chunks and the question are combined into a prompt and the LLM writes an answer that cites the sources.

Benefits of RAG: it reduces hallucinations, lets the model use private or recent data without fine-tuning, makes answers verifiable through citations, and keeps knowledge easy to update — changing a document changes the answer immediately.

Common pitfalls include retrieving irrelevant chunks (poor chunking or weak ranking), exceeding the context window, and prompt injection, where text inside a retrieved document tries to override the system instructions. Mitigations: re-rank retrieved results, keep chunks focused, clearly delimit sources and instruct the model to treat them as untrusted data, validate that citations refer to retrieved documents, and tell the model to say it does not know when the context is insufficient.

RAG is usually cheaper and faster to iterate on than fine-tuning. Fine-tuning changes a model's behaviour or style; RAG changes what facts it can see.`,
  },
  {
    key: 'cloudflare-workers',
    title: 'Cloudflare Workers Architecture',
    content: `Cloudflare Workers is a serverless platform that runs JavaScript, TypeScript and WebAssembly on Cloudflare's global edge network in more than 300 cities, so code executes close to the user.

How Cloudflare Workers differ from traditional servers: instead of a long-running process or container per application, Workers run inside V8 isolates — lightweight sandboxes in a shared runtime. An isolate starts in milliseconds or less, which practically eliminates cold starts, and thousands of isolates share one process with strong memory isolation. There are no servers to provision, patch or scale; Cloudflare routes each request to a nearby location and scales automatically. Billing is based on requests and CPU time rather than idle server hours.

The trade-offs: Workers use web-standard APIs (fetch, Request, Response, Web Crypto, streams) rather than the full Node.js runtime, although a nodejs_compat flag adds many Node APIs. There are limits on CPU time per request and memory per isolate, and there is no local filesystem, so state must live in platform storage.

Storage and state options: KV is an eventually consistent global key-value store for read-heavy data. R2 is S3-compatible object storage with no egress fees. D1 is a serverless SQLite database. Durable Objects give strongly consistent, single-threaded stateful objects with their own storage, ideal for coordination, real-time collaboration, WebSockets and per-user or per-room state. Queues provide async messaging, and Vectorize stores embeddings.

Workers for Platforms lets a company run its customers' code as isolated Workers in dispatch namespaces, which is how multi-tenant platforms deploy many apps on Cloudflare.`,
  },
]
