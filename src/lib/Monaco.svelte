<script lang="ts">
    import * as monaco from "monaco-editor";
    import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
    import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
    import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
    import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
    import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
    import { onDestroy, onMount } from "svelte";

    let editorElement: HTMLDivElement;
    interface Props {
        editor: monaco.editor.IStandaloneCodeEditor
        content: string
    }

    let { editor = $bindable(), content = $bindable() }: Props = $props();

    onMount(async () => {
        self.MonacoEnvironment = {
            getWorker: function (_: string, label: string) {
                switch (label) {
                    case "json":
                        return new jsonWorker();
                    case "css":
                    case "scss":
                    case "less":
                        return new cssWorker();
                    case "html":
                    case "handlebars":
                    case "razor":
                        return new htmlWorker();
                    case "typescript":
                    case "javascript":
                        return new tsWorker();
                    default:
                        return new editorWorker();
                }
            },
        };

        monaco.editor.defineTheme("collab-doc-theme", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: {},
        });
        monaco.editor.setTheme("collab-doc-theme");
        editor = monaco.editor.create(editorElement, {
            language: "markdown",
            fontSize: 13,
            automaticLayout: true,
            minimap: {
                enabled: false
            },
        });

        const model = editor.getModel()!;
        editor.onDidChangeModelContent(() => {
            content = model?.getValue();
        })
    });

    onDestroy(() => {
        monaco?.editor.getModels().forEach((model) => model.dispose());
        editor?.dispose();
    });

</script>

<style>
    #editor {
        flex: 1 1 0%;
        min-height: 0px;
    }

</style>
<div id="editor" bind:this={editorElement}></div>
