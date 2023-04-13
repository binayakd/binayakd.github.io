import { getAllPostSlugs, getPostDataBySlug } from '../src/lib/posts'


describe("getAllPostSlugs function", () => {
  it("returns arrays of post slugs", async () => {
    const posts = await getAllPostSlugs();
    expect(posts).toBeInstanceOf(Array);
  });
});

