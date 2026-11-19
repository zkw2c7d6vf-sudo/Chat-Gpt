/* Absolute deadlines and committed storage state keep local timers consistent across windows. */
(function(root) {
  'use strict';
  const KEY='midnight-focus-v3';
  class FocusTimer {
    constructor({storage,now=()=>Date.now(),onComplete=()=>{}}={}) {
      this.storage=storage;this.now=now;this.onComplete=onComplete;this.persistent=!!storage;this.saved=null;
      this.state={duration:25*60000,remaining:25*60000,running:false,endsAt:0,lastCompletedAt:0};
      this.sync();
      try{if(!this.saved){const legacy=Number(storage?.getItem('midnight-focus')||0);if(legacy>now())this.state={...this.state,running:true,endsAt:legacy,remaining:Math.min(this.state.duration,legacy-now())};}}catch{this.persistent=false;}
    }
    sync(){
      try{
        const raw=this.storage?.getItem(KEY);if(raw===this.saved)return false;
        const value=JSON.parse(raw||'null');this.saved=raw;
        if(value&&Number.isFinite(value.duration)&&value.duration>=60000&&value.duration<=10800000&&Number.isFinite(value.remaining)&&value.remaining>=0&&value.remaining<=value.duration&&typeof value.running==='boolean'&&Number.isFinite(value.endsAt)) {this.state={...value};return true;}
      }catch{this.persistent=false;}return false;
    }
    save(){try{if(!this.storage)throw new Error('No storage');const raw=JSON.stringify(this.state);this.storage.setItem(KEY,raw);this.saved=raw;this.persistent=true;}catch{this.persistent=false;}}
    snapshot(){
      this.sync();
      if(this.state.running){this.state.remaining=Math.max(0,this.state.endsAt-this.now());if(!this.state.remaining){this.state.lastCompletedAt=this.state.endsAt;this.state.running=false;this.state.endsAt=0;this.save();this.onComplete();}}
      return {...this.state,persistent:this.persistent};
    }
    select(minutes){if(!Number.isFinite(minutes)||minutes<1||minutes>180)return;this.sync();this.state={...this.state,duration:minutes*60000,remaining:minutes*60000,running:false,endsAt:0};this.save();}
    toggle(){this.snapshot();if(this.state.running){this.state.running=false;this.state.endsAt=0;}else{if(!this.state.remaining)this.state.remaining=this.state.duration;this.state.running=true;this.state.endsAt=this.now()+this.state.remaining;}this.save();}
    reset(){this.sync();this.state={...this.state,remaining:this.state.duration,running:false,endsAt:0};this.save();}
    dismissReceipt(){this.state.lastCompletedAt=0;this.save();}
  }
  root.MidnightFocus=FocusTimer;if(typeof module!=='undefined')module.exports=FocusTimer;
})(globalThis);
