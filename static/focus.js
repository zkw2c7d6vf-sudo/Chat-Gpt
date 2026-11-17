/* Local timer model: absolute deadlines survive reload and device sleep. */
(function(root) {
  'use strict';
  class FocusTimer {
    constructor({storage, now=()=>Date.now(), onComplete=()=>{}}={}) {
      this.storage=storage; this.now=now; this.onComplete=onComplete;
      this.state={duration:25*60000,remaining:25*60000,running:false,endsAt:0};
      try {
        const saved=JSON.parse(storage?.getItem('midnight-focus-v3') || 'null');
        if (saved && Number.isFinite(saved.duration) && saved.duration>=60000 && saved.duration<=180*60000 && Number.isFinite(saved.remaining) && saved.remaining>=0 && saved.remaining<=saved.duration && typeof saved.running==='boolean' && Number.isFinite(saved.endsAt)) this.state=saved;
        else {
          const legacy=Number(storage?.getItem('midnight-focus') || 0);
          if (legacy>this.now()) this.state={...this.state,running:true,endsAt:legacy,remaining:Math.min(this.state.duration,legacy-this.now())};
        }
      } catch {}
    }
    save() { try { this.storage?.setItem('midnight-focus-v3',JSON.stringify(this.state)); } catch {} }
    snapshot() {
      if (this.state.running) {
        this.state.remaining=Math.max(0,this.state.endsAt-this.now());
        if (!this.state.remaining) { this.state.running=false; this.state.endsAt=0; this.save(); this.onComplete(); }
      }
      return {...this.state};
    }
    select(minutes) {
      if (!Number.isFinite(minutes) || minutes<1 || minutes>180) return;
      this.state={duration:minutes*60000,remaining:minutes*60000,running:false,endsAt:0}; this.save();
    }
    toggle() {
      this.snapshot();
      if (this.state.running) { this.state.running=false; this.state.endsAt=0; }
      else { if (!this.state.remaining) this.state.remaining=this.state.duration; this.state.running=true; this.state.endsAt=this.now()+this.state.remaining; }
      this.save();
    }
    reset() { this.state={...this.state,remaining:this.state.duration,running:false,endsAt:0}; this.save(); }
  }
  root.MidnightFocus=FocusTimer;
  if (typeof module!=='undefined') module.exports=FocusTimer;
})(globalThis);
