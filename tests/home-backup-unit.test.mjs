import test from "node:test";
import assert from "node:assert/strict";
import { createBackup, parseBackup, applyBackup } from "../src/backup.ts";
class Store {
  map = new Map();
  getItem(k) { return this.map.get(k) ?? null; }
  setItem(k,v) { this.map.set(k,v); }
  removeItem(k) { this.map.delete(k); }
}
function layout(scene) {
  return { version:1, space:"Study", scene, spaces:{ Study:{ email:{ x:15,y:26,width:340,height:290,closed:false,minimized:true,expanded:false,z:2 } } } };
}
const gradient = { id:"preset-nightfall",title:"Nightfall",category:"Space",background:"linear-gradient(#091329,#0a1021)" };
test("Home layout survives approved Orbit backup and restore", () => {
  const original = new Store(); original.setItem("orbit-immersive-home-v1",JSON.stringify(layout(gradient)));
  const exported = createBackup(original);
  const recovered = new Store();
  applyBackup(parseBackup(JSON.stringify(exported)), recovered);
  assert.equal(JSON.parse(recovered.getItem("orbit-immersive-home-v1")).spaces.Study.email.minimized,true);
});
test("uploaded custom background image bytes never leave in backup", () => {
  const original = new Store(); original.setItem("orbit-immersive-home-v1",JSON.stringify(layout({id:"custom",title:"personal.jpg",category:"My images",background:"data:image/jpeg;base64,PRIVATEDATA"})));
  const backup = createBackup(original);
  assert.equal(JSON.stringify(backup).includes("PRIVATEDATA"),false);
  assert.equal(backup.data["orbit-immersive-home-v1"].scene.id,"preset-nightfall");
});
test("unsafe Home backup scene URLs are rejected without restoring", () => {
  const bad = {format:"orbit-dashboard-backup",version:"1",createdAt:new Date().toISOString(),data:{"orbit-immersive-home-v1":layout({id:"bad",title:"Bad",category:"External",background:"javascript:alert(1)"})}};
  assert.throws(() => parseBackup(JSON.stringify(bad)),/invalid/);
});
