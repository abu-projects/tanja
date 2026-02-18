import { onRequestOptions, onRequestPost } from "../functions/api/contact.js";

function methodNotAllowed() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "OPTIONS, POST",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      const context = {
        request,
        env,
        waitUntil: ctx.waitUntil.bind(ctx),
      };

      if (request.method === "POST") {
        return onRequestPost(context);
      }

      if (request.method === "OPTIONS") {
        return onRequestOptions(context);
      }

      return methodNotAllowed();
    }

    return env.ASSETS.fetch(request);
  },
};
