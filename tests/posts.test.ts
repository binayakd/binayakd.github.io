import { getAllPostSlugs } from '../src/lib/posts'


describe("getAllPostSlugs function", () => {
  it("returns arrays of post slugs", async () => {
    const posts = await getAllPostSlugs();
    expect(posts).toBeInstanceOf(Array);
  });
});

// describe("fetchMarkdownPosts function", () => {
//   it("returns arrays of posts", () => {
//     const posts = fetchMarkdownPosts();
//     expect(posts).toBeInstanceOf(Array);
//   });
// });