<script lang="ts">
    import * as Popover from "./components/ui/popover";
    import { Label } from "./components/ui/label";
    import { Input } from "./components/ui/input";
    import Icon from "./Icon.svelte";
    let { name, hue, isMe = false } = $props()
    let input = $state("Anonymous " + name)
    let width = "1.25rem"
    let fill = `hsl(${hue}, 90%, 75%)`;

</script>

   <Popover.Root>
    <Popover.Trigger class="flex gap-1" >
        <Icon {name} {width} {fill}/> 
        {#if isMe}
        <p class="user">(you)</p>
        {/if}
        <!-- <div class="user">{name}</div> -->
    </Popover.Trigger>
    <Popover.Content>
        <Label for="userInfo">Update Info</Label>
        <form class="flex w-full max-w-sm items-center space-x-2">
            <Input id="userInfo" bind:value={input} />
            <Popover.Close>Submit</Popover.Close>
          </form>
    </Popover.Content>
   </Popover.Root>

   <style>
    .user {
        top: 1.5px;
        position: relative;
    }
   </style>
