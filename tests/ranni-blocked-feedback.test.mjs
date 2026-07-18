// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildRanniProjectionFeedbackGeometry, createRanniVisualAdapter } from "../Champions/ranni/visuals.ts";
import { updateRanniIceBlinkChannel } from "../Champions/ranni/skill.ts";
import { RANNI_SKILL_COOLDOWN_MS } from "../Champions/ranni/definition.ts";

function channelingRanni() { return { id:1,active:true,alive:true,tile:{x:5,y:1},position:{x:220,y:47.5},velocity:{x:0,y:0},direction:"down",lastMoveDirection:"down",skill:{id:"ranni-ice-blink",phase:"channeling",channelRemainingMs:100,cooldownRemainingMs:0,castElapsedMs:1400,projectedPosition:{x:220,y:47.5},projectedLastMoveDirection:"down",projectedBombEgressIds:[]} }; }
function updateWith(context) { return (player,direction,pressed,_held,ms) => updateRanniIceBlinkChannel(player,direction,pressed,ms,context); }

describe("feedback visual da Ranni bloqueada", () => {
  it("distingue tentativa bloqueada de uma projeção com deslocamento", () => {
    expect(buildRanniProjectionFeedbackGeometry({x:220,y:47.5},{x:220,y:47.5},true)).toEqual({originX:220,originY:47.5,targetX:220,targetY:47.5,distancePx:0,hasDisplacement:false,blocked:true});
    expect(buildRanniProjectionFeedbackGeometry({x:220,y:47.5},{x:220,y:87.5},true)).toMatchObject({distancePx:40,hasDisplacement:true,blocked:false});
  });
  it("registra falha visual sem mudar posição nem cooldown do cast", () => {
    const player=channelingRanni(),visuals=createRanniVisualAdapter();
    const handled=visuals.updateSkillChannel(player,"down",true,false,16.67,updateWith({canOccupyPosition:()=>true,getTileFromPosition:(p)=>({x:Math.floor(p.x/40),y:Math.floor(p.y/40)})}));
    expect(handled).toBe(true);expect(player.position).toEqual({x:220,y:47.5});expect(player.skill.phase).toBe("cooldown");expect(player.skill.cooldownRemainingMs).toBe(RANNI_SKILL_COOLDOWN_MS);expect(visuals.getFeedback(1)).toEqual({kind:"failed",position:{x:220,y:47.5},elapsedMs:0});
  });
  it("registra bloqueio enquanto uma direção não consegue mover o fantasma", () => {
    const player=channelingRanni(),visuals=createRanniVisualAdapter();player.skill.channelRemainingMs=1000;
    visuals.updateSkillChannel(player,"down",false,false,16.67,updateWith({bombs:[],clonePlayerState:(source)=>structuredClone(source),getTileFromPosition:(p)=>({x:Math.floor(p.x/40),y:Math.floor(p.y/40)}),resolveMovementDirection:(_g,d)=>d,movePlayerSimulated:()=>{},isPositionOverlappingTile:()=>false}));
    expect(player.skill.phase).toBe("channeling");expect(player.skill.projectedPosition).toEqual({x:220,y:47.5});expect(visuals.getFeedback(1)).toEqual({kind:"blocked",position:{x:220,y:47.5},elapsedMs:0});
  });
});
