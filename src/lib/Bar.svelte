<script lang="ts">
    import Action from "./Action.svelte";
    import type { UserInfo } from "./collab";
    import User from "./User.svelte";
    interface Props {
        users: Record<number, { name: string; color: number }>;
        link: string;
        mode: string;
        currentUser: UserInfo
    }
    let { users, link, currentUser, mode = $bindable("") }: Props = $props();
    let highlightColor = "#0366d6";

    function onclick(e: MouseEvent) {
        const element = e.target as HTMLButtonElement;
        if (element) {
            const elementMode = element.getAttribute("name")?.toLowerCase();
        
        if (elementMode) {
            if (mode === "split") {
                mode = elementMode; // Toggle back to single mode
            } else if (mode === elementMode) {
                mode = "split"; // Switch to split if already active
            } else {
                mode = elementMode; // Switch to new mode
            }
        }
        }
    }

    async function handleCopy() {
        await navigator.clipboard.writeText(link);
    }
</script>

<div class="bar">
    <div class="left">
            <User name={currentUser.name} color={currentUser.color} isMe={true}/>
        {#each Object.entries(users) as [id, user]}
            <User name={user.name} color={user.color} />
        {/each}
    </div>
    <div class="middle">
        <p class="share">Share link</p>
        <div class="copy">
            <input class="link" value={link} />
            <div class="copy-button">
                <button onclick={handleCopy} type="button">Copy</button>
            </div>
        </div>
    </div>
    <div class="right">
        <!-- <Action name="Table of Contents">
        </Action> -->
        <Action name="Editor" {onclick}>
            Switch to Editor Only Mode. Click this
            action again to switch back to Split Mode.
        </Action>
        <Action name="View" {onclick}>
            Switch to View Only Mode. Click this
            action again to switch back to Split Mode.
        </Action>
        <Action name="About">
            <p>
                An open-source collaborative markdown editor using the <a
                    href="https://en.wikipedia.org/wiki/Operational_transformation" target="_blank"
                    ><strong>operational transform</strong></a
                >
                protcol. Share a link to this document with others, and they can
                edit from their browser while seeing your changes in real time. See
                the
                <a href="https://github.com/komialasse/markitdown" target="_blank"
                    >GitHub repository</a
                > for details.
            </p>
        </Action>
        <a class="github-link" href="https://github.com/komialasse/markitdown" target="_blank">
            Github
        </a>
    </div>
</div>

<style>
    .github-link {
        position: relative;
        padding: 2.5px;
    }
    .share {
        top: 3px;
        position: relative;
    }
    .copy-button {
        border: solid #e2e8f0;
        background-color: #e2e8f0;
    }
    .copy {
        display: flex;
        position: relative;
        isolation: isolate;
    }
    .middle {
        display: flex;
        vertical-align: middle;
        text-align: center;
        flex: 1 0 0;
        margin-right: auto;
        gap: 0.5em;
    }
    .link {
        padding-left: 0.25em;
        border: 1.5px solid #e1e4e8;
        min-width: 185px;
    }
    .left {
        display: flex;
        flex: 1 0 0;
        gap: 0.5em;
    }
    .right {
        display: flex;
        gap: 0.5em;
        margin-left: 200px;
    }
    .bar {
        font-size: 13px;
        display: flex;
        align-items: center;
        padding: 4px 12px;
        border-bottom: 1px solid #e1e4e8;
        background-color: #fafbfc;
    }
    a {
        /* need this for anchor fixed header  https://stackoverflow.com/questions/10732690 */
        text-decoration: underline;
    }
</style>
