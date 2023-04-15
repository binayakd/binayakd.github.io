
import { getAllPostSlugs, getPostDataBySlug, type PostData } from '$lib/posts';
import type { PageServerLoad } from './$types';

export const load = (() => {

    const postDataList: PostData[] = []

    const allSlugs = getAllPostSlugs();

    allSlugs.forEach(async slug => {
        const postData = await getPostDataBySlug(slug, false)
        postDataList.push(postData)
    });

    return { postDataList }
}) satisfies PageServerLoad;