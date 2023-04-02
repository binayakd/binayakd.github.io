import { getPosts} from '../src/lib/posts'


describe("getPosts function", () => {
  it("returns arrays of posts", () => {
    const posts = getPosts("./posts");
    expect(posts).toBeInstanceOf(Array);
  });
});

// describe("fetchMarkdownPosts function", () => {
//   it("returns arrays of posts", () => {
//     const posts = fetchMarkdownPosts();
//     expect(posts).toBeInstanceOf(Array);
//   });
// });