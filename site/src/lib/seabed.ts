/** Broad, asymmetric sand shelves leave open channels between the island roots. */
export function seabedHeight(x:number,z:number) {
  let height=-5.7-.18*Math.hypot(x/12.6,z/11.5);
  const shelves=[[-5.6,7.8,2.6,2.1,1.7],[-1.8,9.0,2.5,1.5,1.0],[3.7,8.1,2.7,2.0,1.9],
    [7.6,4.9,1.5,2.4,1.6],[-8.1,1.2,1.5,2.5,1.3],[0,2.0,1.25,3.6,1.1]];
  for(const [cx,cz,sx,sz,rise] of shelves){
    const distance=((x-cx)/sx)**2+((z-cz)/sz)**2;
    height+=rise*Math.exp(-distance*distance*.8);
  }
  // A gently winding pale channel, not a regularly stepped concentric basin.
  const channel=x-(-.7+Math.sin(z*.55)*1.2);
  height-=.25*Math.exp(-channel*channel/1.2);
  return height+.055*Math.sin(x*2.7+Math.sin(z*1.3))+.035*Math.sin(z*4.1+x*1.9);
}

export const REEF_SPURS=[[-7.5,6.8,.85,1.7],[-5.6,7.4,1.05,2.0],[-3.5,7.0,.65,1.4],
      [-1.4,6.4,.8,1.8],[1.1,7.4,1.12,1.5],[3.5,7.2,1.0,2.0],[6.1,6.9,.75,1.8],
      [-7.8,3.2,.65,1.6],[7.9,3.4,.75,1.7],[-.2,1.4,.6,1.3],
      [-6.9,9.0,.7,.9],[-4.1,9.1,.55,1.0],[-.8,9.1,.72,1.1],[4.7,9.0,.65,1.0],
      [7.3,8.6,.7,1.3],[-2.,3.8,.65,1.6],[1.6,4.8,.8,1.6]];

/** Conservative clearance over the rounded reef buttresses, including a fish body. */
export function reefClearanceAt(x:number,z:number) {
  let clearance=seabedHeight(x,z)+.35;
  for(const [cx,cz,width,rise] of REEF_SPURS) {
    const distance=Math.hypot((x-cx)/(width*1.5+.35),(z-cz)/(width*1.5+.35));
    if(distance>1.7)continue;
    const top=Math.min(-1.65,seabedHeight(cx,cz)-.18+rise)+.6;
    clearance=Math.max(clearance,top-Math.max(0,distance-1)*2.5);
  }
  return clearance;
}
