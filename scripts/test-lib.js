const { getPostBySlug, getAllPosts } = require("./src/lib/posts");
console.log("Posts count:", getAllPosts().length);
const post = getPostBySlug("hello-world");
console.log("hello-world:", post ? `title=${post.meta.title}, content=${post.content.substring(0,80)}` : "NOT FOUND");
