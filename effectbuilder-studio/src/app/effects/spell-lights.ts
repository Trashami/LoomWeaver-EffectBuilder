import type { EffectDefinition } from './effect-definition';
export interface GpuLightSourceInput {x:number;y:number;elevationZ:number;radius:number;intensity:number;color:string;coreSize:number;softness:number;isCelestial:boolean;isSpotlight:boolean;coneAngle:number;coneSpread:number;isWarmFlame:boolean;}
import { parseLight } from './spell-light-settings';
import { materialFrame, projectileMaterialPoint } from './arcane-motion';
import { opacityAt } from '../shared/animation/animation-curves';
import { clippedFireball, fireballContact, FIREBALL_FLIGHT_FRACTION, EffectWorld, FxPoint } from './fireball-motion';
import { missileTiming, missilePosition } from './missile-path';
import { handFrame } from './mage-hand-path';

/** The light follows the same deterministic motion functions as its visible material. */
export function spellLights(def:EffectDefinition,time:number,from:FxPoint,to:FxPoint,scale=1,targets:FxPoint[]=[to],world:EffectWorld={}):GpuLightSourceInput[]{
 const lights:GpuLightSourceInput[]=[];
 for(const l of def.layers){
  const settings=parseLight(l.lighting),local=(time-l.delay)/l.duration;
  if(!settings.enabled||!l.enabled||local<=0||local>=1)continue;
  const f=materialFrame(l,time,from,to,scale),p=f.p;
  const alpha=(l.opacity??1)*opacityAt(l.opacityKeyframes??[],local)*l.intensity*f.envelope;
  if(alpha<=.001||settings.intensity===0)continue;
  let points:FxPoint[]=[f.anchor];let gain=1;
  if(l.missile){points=[];for(let bolt=0;bolt<3;bolt++){const timing=missileTiming(l.duration,l.missile.launchGap,bolt),q=(p*l.duration-timing.offset)/timing.flight;if(q>0&&q<1)points.push(missilePosition(q,from,targets[l.missile.targets[bolt]]??to,bolt,l.missile,scale));}}
  else if(l.mageHand){const frame=handFrame(l.mageHand,p,from,to);points=[frame];gain=frame.size*frame.alpha;}
  else if(l.fireMaterial){const m=l.fireMaterial,arrival=m.role==='projectile'?l.delay+l.duration*FIREBALL_FLIGHT_FRACTION:world.flight?.arrival??l.delay,target=world.targetAt?.(arrival)??to;
   const dx=target.x-from.x,dy=target.y-from.y,d=Math.hypot(dx,dy)||1,release={x:from.x+dx/d*25*scale,y:from.y+dy/d*25*scale},arc=m.role==='impact'?world.flight?.arc??m.arc:m.arc;
   if(m.role==='projectile'){const progress=p/FIREBALL_FLIGHT_FRACTION;points=progress<1?[clippedFireball(release,target,progress,arc,scale,world.walls)]:[];}
   else if(m.role==='caster'){points=[from];gain=Math.min(1,local*4)*(1-local**4);}
   else {points=[fireballContact(release,target,arc,scale,world.walls).point];gain=(1-local)**.7;}
   points=points.map(q=>({x:q.x+(dx/d*l.offsetX-dy/d*l.offsetY)*scale,y:q.y+(dy/d*l.offsetX+dx/d*l.offsetY)*scale}));
  }
  else if(l.kind==='projectile'){
   const arc=l.projectileCore?.arc??-35;
   const u=Math.max(0,Math.min(1,p*l.motion.speed*1.25/(1+l.motion.drag*p)));
   points=[clippedFireball(from,to,u,arc,scale,world.walls)];
  }
  else if(l.kind==='sky_projectile'||l.kind==='sky_beam'||l.kind==='sky_lightning'){
   const cfg=(l.skyProjectile??l.skyBeam??l.skyLightning) as {skySlantX?:number;skySlantZ?:number;hitOffsetX?:number;hitOffsetZ?:number}|undefined;
   const base=l.anchor==='caster'?from:l.anchor==='path'?{x:(from.x+to.x)*.5,y:(from.y+to.y)*.5}:to;
   const hx=base.x+(cfg?.hitOffsetX??0)*scale,hy=base.y+(cfg?.hitOffsetZ??0)*scale;
   const sx=hx+(cfg?.skySlantX??0)*1.8*scale,sy=hy+(cfg?.skySlantZ??0)*1.8*scale;
   const u=Math.max(0,Math.min(1,p*l.motion.speed*(l.kind==='sky_projectile'?1.15:3.4)));
   points=[{x:sx+(hx-sx)*u,y:sy+(hy-sy)*u}];
  }
  else if(l.kind==='whip'){const lash=f.whipPoints??[];points=[.25,.6,1].map(q=>lash[Math.min(lash.length-1,Math.floor(q*(lash.length-1)))]).filter(Boolean).map(q=>({x:from.x+Math.cos(f.angle)*q.x-Math.sin(f.angle)*q.y,y:from.y+Math.sin(f.angle)*q.x+Math.cos(f.angle)*q.y}));}
  else if(['beam','lightning','tether'].includes(l.kind)||l.cinematic?.style==='beam'){points=[.15,.45,.75,1].map(t=>{const u=t*Math.min(1,p*4*l.motion.speed);return{x:from.x+Math.cos(f.angle)*f.length*u,y:from.y+Math.sin(f.angle)*f.length*u};});}
  else if(l.kind==='cone'||l.cinematic?.style==='cone'){const reach=(l.cinematic?.reachFeet??15)/5*66*scale*Math.min(1,p*4);points=[.2,.5,.8].map(u=>({x:from.x+Math.cos(f.angle)*reach*u,y:from.y+Math.sin(f.angle)*reach*u}));}
  if(l.cinematic){const c=l.cinematic,ox=(Math.cos(f.angle)*l.offsetX-Math.sin(f.angle)*l.offsetY)*scale,oy=(Math.sin(f.angle)*l.offsetX+Math.cos(f.angle)*l.offsetY)*scale;
   if(c.style==='column'||c.style==='nova')points=[l.anchor==='caster'?from:to];
   if(c.style==='cube')points=[{x:from.x+Math.cos(f.angle)*c.reachFeet/5*66*scale*.5,y:from.y+Math.sin(f.angle)*c.reachFeet/5*66*scale*.5}];
   points=points.map(q=>({x:q.x+ox,y:q.y+oy}));
  }
  const flicker=1-settings.flicker*(.5+.3*Math.sin(time*.019+l.motion.seed)+.2*Math.sin(time*.043+l.motion.seed*3));
  for(const point of points)lights.push({...point,elevationZ:settings.heightFeet/5*66*scale,radius:settings.radiusFeet/5*66*scale,intensity:settings.intensity*alpha*gain*flicker/Math.sqrt(Math.max(1,points.length)),color:settings.followColor?l.color:settings.color,coreSize:15,softness:settings.softness*100,isCelestial:false,isSpotlight:false,coneAngle:0,coneSpread:90,isWarmFlame:false});
 }
 return lights;
}
