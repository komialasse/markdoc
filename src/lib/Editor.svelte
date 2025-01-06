<script lang="ts">
    import Monaco from "./Monaco.svelte";
    import View from "./View.svelte";
    import markdownSample  from "../../markdown.txt?raw"
    let { mode, editor = $bindable() } = $props();
    let content = $state(markdownSample);
</script>


<div class="editor">
    {#if mode === 'split'}
    <div class="editor cflex">
        <Monaco bind:editor bind:content />
    </div>
        <View {content} />
    {/if}
    {#if mode === 'editor'}
    <div class="editor cflex">
        <Monaco bind:editor bind:content />
    </div>
    {/if}
    {#if mode === 'view'}
        <View {content} />
    {/if}
</div>

<style>
    .editor {
        display: flex;
        min-height: 0px;
        flex: 1 0 0%;
    }

    .cflex {
        flex-direction: column;
    }
</style>
