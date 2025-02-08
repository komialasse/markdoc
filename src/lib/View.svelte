<script lang="ts">
    import {unified} from 'unified'
    import remarkParse from 'remark-parse'
    import remarkGfm from 'remark-gfm'
    import rehypeStringify from 'rehype-stringify'
    import remarkRehype from 'remark-rehype'
    import remarkMath from 'remark-math'
    import rehypeKatex from 'rehype-katex'
    import rehypeShiki from '@shikijs/rehype'
    import remarkEmoji from 'remark-emoji';
    import DOMPurify from 'dompurify'
    const { content } = $props();

    const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeShiki, {
        theme: 'min-light'
    }
  )
    .use(remarkEmoji)
    .use(rehypeStringify)

    /**
	 * async render markdown to html.
	 * @param md markdown.
	 * @returns html.
	 */
    async function render(md: string): Promise<string> {
        const result = await processor.process(md)
        if (!result) {
            return ''
        }
        return DOMPurify.sanitize(String(result))
    }
</script>

<style>
    .view {
        flex: 1 1 0%;
        overflow: auto;
        border-left: 1px solid #e1e4e8;
        padding-left: 24px;
    }

</style>

<div id="view" class="view">
    {#await render(content) then renderedContent}
     {@html renderedContent}
    {/await}
</div>