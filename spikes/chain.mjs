import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const P='Z:/Apps/Disconnect/app/src-tauri/scriptlets/';
const SRC = readFileSync(P+'trusted-prune-window-json.js','utf8')+';'+readFileSync(P+'set-constant.js','utf8');
const window={}; const ctx={window,Object,JSON,Array,String,Number,RegExp,console};
vm.createContext(ctx);
vm.runInContext(SRC+';this.__p=trustedPruneWindowJson;this.__s=setConstant;',ctx);
const {__p:prune,__s:setc}=ctx;
// EXACT production emit order (dumped from the engine)
setc("ytInitialPlayerResponse.adPlacements","undefined");
setc("ytInitialPlayerResponse.playerAds","undefined");
setc("ytInitialPlayerResponse.adSlots","undefined");
prune("ytInitialPlayerResponse","streamingData","adSlots","adPlacements","playerAds","adBreakHeartbeatParams");
window.ytInitialPlayerResponse={streamingData:{formats:[1]},adSlots:[1,2],adPlacements:[1],playerAds:[1],adBreakHeartbeatParams:'x',videoDetails:{title:'real'}};
const r=window.ytInitialPlayerResponse;
console.log(JSON.stringify({
  hasStreamingData: !!(r&&r.streamingData),
  adSlots: r&&r.adSlots, playerAds: r&&r.playerAds,
  title: r&&r.videoDetails&&r.videoDetails.title
}));
