<script lang="ts">
  import Bar from "$lib/Bar.svelte";
  import Editor from "./lib/Editor.svelte";
  import { getHash } from "$lib/util/hash";
  import { getHue, getName } from "$lib/util/user";
  import Icon from "$lib/Icon.svelte";
  import { editor as e } from "monaco-editor/esm/vs/editor/editor.api";
  import { Collab, type UserInfo } from "$lib/collab";
  import { PUBLIC_USE_SERVER } from "$env/static/public";
  let users: Record<number, UserInfo> = $state.raw({});
  let name = $state(getName());
  let hue = $state(getHue());
  let currentUser = { name, hue };
  let mode: string = $state("split");
  let connected = $state(false);
  let hash = getHash();
  let editor = $state() as e.IStandaloneCodeEditor;
  let link = `${window.location.origin}/#${hash}`;
  let collab: Collab;

  function setUsers(newUsers: Record<number, UserInfo>) {
    users = newUsers;
  }


  $effect(() => {
    if (PUBLIC_USE_SERVER  === 'true' && editor?.getModel()) {
      const model = editor.getModel()!;
      model.setValue("");
      model.setEOL(0); // LF
      collab = new Collab({
        uri: getWsUri(hash),
        editor,
        onChangeUsers: setUsers,
        onConnected: () => (connected = true),
        onDisconnected: () => (connected = false),
      });
    }

    return () => {
      collab.dispose();
    };
  });

  $effect(() => {
    if (connected) {
      collab.setInfo({ name, hue });
    }
  });

  function getWsUri(hash: string) {
    let url = new URL(`api/socket/${hash}`, window.location.href);
    url.protocol = url.protocol == "https:" ? "wss:" : "ws:";
    return url.href;
  }
</script>

<h1 class="header">markitdown</h1>
<main class="main">
  <Bar {users} {link} {currentUser} bind:mode />
  <Editor {mode} bind:editor />

  <div class="footer">
    <div class="footer-left">
      <div class="footer-icons">
        <Icon name="docs" />
        <p>documents</p>
        <Icon name="rightarrow" />
        <Icon name="code" />
        <p>{hash}</p>
      </div>
    </div>
    <div class="footer-right">
      {connected ? "Connected!" : "Connecting to server..."}
    </div>
  </div>
</main>

<style>
  .main {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 30px);
    overflow: visible;
    border: 1px solid #e1e4e8;
    margin: 0 1em;
  }
  .header {
    font-family: monospace;
    font-weight: bold;
    font-size: 18px;
    margin: 0 auto;
    padding: 0 50px;
    box-sizing: border-box;
    text-align: center;
  }

  .footer {
    display: flex;
    border-top: 1px solid #e1e4e8;
    border-bottom: 1px solid #e1e4e8;
    font-size: 14px;
    background-color: #fafbfc;
  }

  .footer-left {
    display: flex;
  }
  .footer-right {
    gap: 0.5em;
    margin-left: auto;
    display: flex;
    align-items: center;
    padding-right: 1em;
  }

  .footer-icons {
    display: flex;
    height: 1.5rem;
    align-items: center;
    flex-shrink: 0;
    font-size: 14px;
    color: rgb(136, 136, 136);
    gap: 0.3rem;
    padding: 0.8rem;
  }
</style>
