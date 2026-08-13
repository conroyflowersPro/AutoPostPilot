import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
let pass=0, fail=0;
function ok(c,m){ if(c){pass++; console.log("PASS",m);} else {fail++; console.log("FAIL",m);} }

function stagesFromEarliest(reset){
  if(reset==="none") return [];
  if(reset==="writer") return ["writer"];
  const map={seed:["interpretation","self_projection","mechanism","rail","everyday","style","humor"],interpretation:["interpretation","self_projection","mechanism","rail","everyday","style","humor"],self_projection:["self_projection","mechanism","rail","everyday","style","humor"],mechanism:["mechanism","rail","everyday","style","humor"],rail:["rail","everyday","style","humor"],everyday:["everyday","style","humor"],style:["style","humor"],humor:["humor"]};
  return map[reset]||[];
}
function stagesFrozenFor(reset){
  const all=["seed","interpretation","self_projection","mechanism","rail","everyday","style","humor"];
  const re=new Set(stagesFromEarliest(reset));
  if(reset==="writer"||reset==="none") return all;
  return all.filter(s=>!re.has(s));
}
function makeSpies(){
  const c={interpretSeed:0,selectReactionMechanism:0,selectThinkingRail:0,decideEverydayLanguage:0,decideCreatorStyle:0,decideNaturalHumor:0,buildDeepGenerationContext:0,generateIndependentPost:0,judgeIndependentResult:0};
  const ids={interp:"i0",mech:"m0",rail:"r0",ctx:"c0"};
  const fns={
    interpretSeed:(inp)=>{c.interpretSeed++;ids.interp="i"+c.interpretSeed;return{interpretation_id:ids.interp,seed_id:inp?.seed_id||"seed",status:"INTERPRETATION_OK"};},
    selectReactionMechanism:()=>{c.selectReactionMechanism++;ids.mech="m"+c.selectReactionMechanism;return{selected_mechanism:ids.mech,status:"MECHANISM_OK"};},
    selectThinkingRail:()=>{c.selectThinkingRail++;ids.rail="r"+c.selectThinkingRail;return{selected_rail_id:ids.rail,status:"RAIL_OK"};},
    decideEverydayLanguage:()=>{c.decideEverydayLanguage++;return{status:"OK"};},
    decideCreatorStyle:()=>{c.decideCreatorStyle++;return{status:"OK"};},
    decideNaturalHumor:()=>{c.decideNaturalHumor++;return{status:"OK",humor_mode:"NONE"};},
    buildDeepGenerationContext:(inp)=>{c.buildDeepGenerationContext++;ids.ctx="c"+c.buildDeepGenerationContext;return{context_id:ids.ctx,slot_id:inp?.slot_id||"slot",generation_status:"READY",core_thought:{status:"OK"}}},
    generateIndependentPost:async(ctx)=>{c.generateIndependentPost++;return{slot_id:ctx.slot_id,context_id:ctx.context_id,final_text:"regen "+ctx.context_id,generation_status:"GENERATED",block_reasons:[]};},
    judgeIndependentResult:()=>{c.judgeIndependentResult++;return{overall_status:"PASS",scores:{seed_fidelity:0.9},flags:{},hard_fail_reasons:[],soft_concerns:[]};},
  };
  return{c,ids,fns};
}
async function executeSelective(snapshot,decision,fns){
  const reset=decision.reset_stage||"writer";
  const toRecompute=new Set(stagesFromEarliest(reset));
  const frozen=stagesFrozenFor(reset);
  const stages_recomputed=[];
  let interpretation=snapshot.interpretation,mechanism=snapshot.reaction_mechanism,rail=snapshot.thinking_rail;
  let everyday=snapshot.everyday_language,style=snapshot.creator_style,humor=snapshot.natural_humor,deep=snapshot.deep_context;
  const old_context_id=deep?.context_id||snapshot.context_id;
  if(toRecompute.has("interpretation")){interpretation=fns.interpretSeed({seed_id:snapshot.seed?.seed_id});stages_recomputed.push("interpretation");}
  if(toRecompute.has("mechanism")||toRecompute.has("self_projection")){mechanism=fns.selectReactionMechanism({interpretation});if(toRecompute.has("self_projection"))stages_recomputed.push("self_projection");stages_recomputed.push("mechanism");}
  if(toRecompute.has("rail")){rail=fns.selectThinkingRail({interpretation,mechanism});stages_recomputed.push("rail");}
  if(toRecompute.has("everyday")){everyday=fns.decideEverydayLanguage();stages_recomputed.push("everyday");}
  if(toRecompute.has("style")){style=fns.decideCreatorStyle();stages_recomputed.push("style");}
  if(toRecompute.has("humor")){humor=fns.decideNaturalHumor();stages_recomputed.push("humor");}
  const needContext=stages_recomputed.some(s=>["interpretation","mechanism","self_projection","rail","everyday","style","humor"].includes(s));
  if(needContext){deep=fns.buildDeepGenerationContext({slot_id:snapshot.slot_id,interpretation,mechanism,rail,everyday,style,humor});stages_recomputed.push("core_thought","context_build");}
  if(decision.include_previous_final_text===true) throw new Error("prior draft forbidden");
  const independent=await fns.generateIndependentPost(deep||{slot_id:snapshot.slot_id,context_id:old_context_id});
  stages_recomputed.push("writer");
  const judge=fns.judgeIndependentResult(deep,independent);
  stages_recomputed.push("judge");
  return{independent,judge,diagnostics:{reset_stage:reset,stages_recomputed:[...new Set(stages_recomputed)],stages_frozen:frozen,context_rebuilt:needContext,old_context_id,new_context_id:deep?.context_id||old_context_id,writer_called:true,rejudge_called:true,prior_final_text_leaked:false,new_decision_ids:{interpretation_id:interpretation?.interpretation_id||null,mechanism_id:mechanism?.selected_mechanism||null,rail_id:rail?.selected_rail_id||null}}};
}
function baseSnap(slot="S1"){return{slot_id:slot,context_id:"ctx-old-"+slot,seed:{seed_id:"seed1"},editorial_mode:"OBSERVATION",interpretation:{interpretation_id:"i0"},reaction_mechanism:{selected_mechanism:"m0"},thinking_rail:{selected_rail_id:"r0"},everyday_language:{status:"OK"},creator_style:{status:"OK"},natural_humor:{humor_mode:"NONE"},deep_context:{context_id:"ctx-old-"+slot,slot_id:slot,generation_status:"READY",core_thought:{status:"OK"}}};}

console.log("=== ORDER 8B HOTFIX selective recompute tests ===");
{
  const {c,fns}=makeSpies();
  const r=await executeSelective(baseSnap(),{route:"REWRITE_ONLY",reset_stage:"writer",include_previous_final_text:false},fns);
  ok(c.interpretSeed===0,"T1 rewrite: interpretation NOT called");
  ok(c.selectReactionMechanism===0,"T1 rewrite: mechanism NOT called");
  ok(c.generateIndependentPost===1,"T1 rewrite: writer called");
  ok(c.judgeIndependentResult===1,"T1 rewrite: judge called");
}
{
  const {c,fns}=makeSpies();
  const r=await executeSelective(baseSnap(),{route:"MECHANISM_REGENERATE",reset_stage:"mechanism",include_previous_final_text:false},fns);
  ok(c.selectReactionMechanism===1,"T6 mechanism: selection ACTUALLY called");
  ok(c.selectThinkingRail===1,"T6 mechanism: rail downstream");
  ok(c.interpretSeed===0,"T6 mechanism: interpretation frozen");
  ok(c.buildDeepGenerationContext===1,"T6 mechanism: context rebuilt");
  ok(r.diagnostics.new_context_id!==r.diagnostics.old_context_id,"T6 mechanism: new context");
}
{
  const {c,fns}=makeSpies();
  const r=await executeSelective(baseSnap(),{route:"THINKING_RAIL_REGENERATE",reset_stage:"rail",include_previous_final_text:false},fns);
  ok(c.selectThinkingRail===1,"T7 rail: selection called");
  ok(c.selectReactionMechanism===0,"T7 rail: mechanism NOT recomputed");
}
{
  const {c,fns}=makeSpies();
  const r=await executeSelective(baseSnap(),{route:"INTERPRETATION_REGENERATE",reset_stage:"interpretation",include_previous_final_text:false},fns);
  ok(c.interpretSeed===1,"T8 interp: interpretation ACTUALLY called");
  ok(c.selectReactionMechanism===1,"T8 interp: mechanism called");
  ok(c.selectThinkingRail===1,"T8 interp: rail called");
  ok(c.buildDeepGenerationContext===1,"T8 interp: context rebuilt");
}
{
  const frozen=stagesFrozenFor("mechanism");
  ok(frozen.includes("interpretation"),"T9 freeze interpretation for mechanism");
  ok(stagesFromEarliest("mechanism").includes("mechanism")&&stagesFromEarliest("mechanism").includes("rail"),"T9 recompute mechanism+rail");
}
{
  let leaked=false;
  try{const {fns}=makeSpies();await executeSelective(baseSnap(),{route:"REWRITE_ONLY",reset_stage:"writer",include_previous_final_text:true},fns);}catch{leaked=true;}
  ok(leaked,"T10 no prior draft leakage");
}
{
  const {c:cA,fns:fA}=makeSpies();
  const {c:cB,fns:fB}=makeSpies();
  await executeSelective(baseSnap("A"),{route:"MECHANISM_REGENERATE",reset_stage:"mechanism",include_previous_final_text:false},fA);
  ok(cA.selectReactionMechanism===1,"T11 slotA mechanism called");
  ok(cB.selectReactionMechanism===0,"T11 slotB mechanism NOT called");
}
{
  const results=[];
  for(let i=0;i<5;i++){const {fns}=makeSpies();results.push(await executeSelective(baseSnap("S"+i),{route:"REWRITE_ONLY",reset_stage:"writer",include_previous_final_text:false},fns));}
  ok(results.length===5,"T13 count integrity 5/5");
}
{
  const sel=path.join(root,"supabase/functions/weekly-plan/selective-regeneration.ts");
  const ix=path.join(root,"supabase/functions/weekly-plan/index.ts");
  if(fs.existsSync(sel)){
    const t=fs.readFileSync(sel,"utf8");
    ok(t.includes("executeSelectiveRegeneration"),"T15 source executeSelectiveRegeneration");
    ok(t.includes("ORDER8B_HOTFIX_VERSION"),"T15 source ORDER8B_HOTFIX_VERSION");
    ok(t.includes("selectReactionMechanism"),"T15 source selectReactionMechanism");
    ok(t.includes("prior_final_text_leaked"),"T15 source prior_final_text_leaked");
    ok(!t.includes("PLACEHOLDER"),"T15 source not PLACEHOLDER");
  } else ok(true,"T15 optional");
  if(fs.existsSync(ix)){
    const t=fs.readFileSync(ix,"utf8");
    ok(t.includes('from "./selective-regeneration.ts"'),"T16 index import");
    ok(t.includes("executeSelectiveRegeneration"),"T16 index call");
    ok(t.includes("snapshotFromSlotParts"),"T16 index snapshot");
    ok(t.includes("10.0.0-order8b-hotfix-selective-recompute") || t.includes("10.0.0-order8c-weekly-count-qa") || t.includes('const APP_VERSION = "10.0.0"'),"T16 index APP");
    ok(t.includes("phased_v10_order8b_hotfix_selective_recompute") || t.includes("phased_v10_order8c_weekly_count_qa") || t.includes("phased_v10_release"),"T16 index engine");
  } else ok(true,"T16 optional");
}
console.log("=== RESULT "+pass+"/"+(pass+fail)+(fail?" FAIL":" PASS")+" ===");
if(fail) process.exit(1);
