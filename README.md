# markitdown

A _real-time_ collaborative markdown editor based on operational transform. Share a link and collaborate with others on a document in seconds.

The frontend is written in Svelte and TypeScript, while the server is written in Rust with [warp](https://github.com/seanmonstar/warp). The operational transform logic for text processing is compiled to WebAssembly using [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen). This code runs in the browser and clients communicate with a central server through WebSockets. 

The server itself stores state within in-memory data structures and broadcasts messages to clients. This allows the server to quickly serve many clients at once, with the tradeoff being documents are lost on restart. Operational transform is good because of the simplicity of it's implementation, though there are more robust [CRDT algorithms](https://arxiv.org/abs/2409.14252) present.

## Development

Node, Rust, and [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) are dependencies of this application. You can run the application from the project root. To start, build the WebAssembly rust module.

```
wasm-pack build wasm
```

After that, you can install the dependencies for the frontend

```
npm install
```

Next, compile and run the backend rust server.

```
cargo run
```

While the server is running, open another terminal and run the following command to start the Svelte frontend.

```
npm run dev
```

This command opens a browser window to `http://localhost:5173`, where code changes are hot-reloaded.

## Deployment

markitdown is self hosted and the entire application fits into a single Docker image. You can manually build it with `docker build -t markitdown`. Then type this command to start the container locally.

```
docker run -dp 5050:5050 markitdown
```

A public version of this image is deployed to [Render.com](https://render.com/) that users can interact with.