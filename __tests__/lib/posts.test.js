import "@testing-library/jest-dom/extend-expect";
import { getAllPostIds, throughDirectory, postsDirectory } from '../../lib/posts'

test("Test getAllPostIds", () => {
    const actual = getAllPostIds();
    console.log(JSON.stringify(actual));
    expect(actual).not.toBeNull();
});

test("Test throughDirectory", () => {
    const actual = throughDirectory(postsDirectory);
    console.log(actual);
    expect(actual).not.toBeNull();
});