// Readiness formula shared by Coach, Vitals and the morning push (api/_lib/morning-message.mjs).
// Loaded as a classic <script> in the browser and required by the Node tests and API functions.
(function (root) {
  const BL = {
    hrv:  {mean:74.56,std:16.26,w:0.45},
    rhr:  {mean:52.46,std:4.55, w:0.25},
    sleep:{mean:7.97, std:0.78, w:0.20},
    tsb:  {mean:-1.33,std:4.58, w:0.10},
  };

  function calcRecovery(hrv,rhr,sleep,tsb){
    if(hrv==null)return null;
    let z=0,wt=0;
    if(hrv!=null){z+=BL.hrv.w*(hrv-BL.hrv.mean)/BL.hrv.std;wt+=BL.hrv.w;}
    if(rhr!=null&&rhr<65){z+=BL.rhr.w*(BL.rhr.mean-rhr)/BL.rhr.std;wt+=BL.rhr.w;}
    if(sleep!=null){z+=BL.sleep.w*(sleep-BL.sleep.mean)/BL.sleep.std;wt+=BL.sleep.w;}
    if(tsb!=null){z+=BL.tsb.w*(tsb-BL.tsb.mean)/BL.tsb.std;wt+=BL.tsb.w;}
    if(wt===0)return null;
    return Math.min(100,Math.max(1,Math.round(50+(z/wt)*wt*16.6)));
  }

  function calcSleep(hrs,score,s8){
    if(hrs==null)return null;
    const dur=Math.min(100,(hrs/7.5)*100);
    const res=score??70;
    let con=70;
    const v=(s8??[]).filter(x=>x!=null);
    if(v.length>=4){const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);con=Math.min(100,Math.max(0,(1-Math.max(0,sd-0.5)/1.5)*100));}
    return Math.min(100,Math.max(0,Math.round(0.50*dur+0.30*res+0.20*con)));
  }

  const SUBJ_SCORE=[90,68,42,10];
  function calcSubjectiveScore(subj){const f=subj?.fatigue!=null?SUBJ_SCORE[subj.fatigue-1]:null;const s=subj?.soreness!=null?SUBJ_SCORE[subj.soreness-1]:null;if(f==null&&s==null)return null;if(f==null)return s;if(s==null)return f;return Math.round(f*0.6+s*0.4);}
  function calcReadiness(r,s,subj){if(r==null||s==null)return null;const sub=calcSubjectiveScore(subj);if(sub==null)return Math.min(100,Math.max(1,Math.round(r*0.5+s*0.5)));return Math.min(100,Math.max(1,Math.round(r*0.4+s*0.2+sub*0.4)));}

  function verdictColor(r){return r>=65?'green':r>=45?'yellow':'red';}

  const api = { BL, calcRecovery, calcSleep, calcSubjectiveScore, calcReadiness, verdictColor };
  Object.assign(root, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
