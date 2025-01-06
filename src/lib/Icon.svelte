<script lang="ts">
    import {icons} from '$lib/icons'
    interface Props {
        name: keyof typeof icons
        width?: string
        class?: string
        fill?: string
    }
    let { name, 
        fill = 'currentColor', 
        width = '1rem',
    class: className = '' }: Props = $props()
    // controls svg width and height
    let height = '1.6rem';
    let focusable: string | number | null | undefined = undefined;
    const {box, path}= icons[name];
</script>

<svg
    class={className}
    {name}
    {focusable}
    {width}
    {height}
    {fill}
    viewBox="0 0 {box} {box}">{@html path}</svg
>