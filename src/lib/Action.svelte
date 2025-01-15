<script lang="ts">
    import type { MouseEventHandler } from "svelte/elements";
    import * as Tooltip from "./components/ui/tooltip";
    import Icon from "./Icon.svelte";
    interface Props {
        name: string
        open?: boolean
        onclick?: MouseEventHandler<HTMLButtonElement> | null | undefined
        children?: Function
    }
    let {name, open = false, onclick, children = () => {}}: Props = $props();
    let fill = "none";
    let openDelay = 40;
</script>
    
   <Tooltip.Root {openDelay} {open}>
    <Tooltip.Trigger {name} {onclick}
    >
            {name}
            <!-- <Icon {name} {fill}/> -->
    </Tooltip.Trigger>
    <Tooltip.Content class="bg-white text-black w-auto max-w-64 shadow-2xl" on:mouseleave={(e) => {}}>
        {@render children()}
    </Tooltip.Content>
   </Tooltip.Root>