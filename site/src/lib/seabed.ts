/** Continuous reef shelves shared by the visible seabed and loose rock placement. */
export function seabedHeight(x:number,z:number) {
  let height=-5.6-.25*Math.hypot(x/12.6,z/10.3);
  const shelves=[[-5.7,7.1,1.9,1.1,1.8],[-1.2,7.5,1.5,.95,1.3],[3.8,7.4,1.7,1.1,2.2],
    [7.6,4.9,1.2,1.9,1.7],[-8.1,1.2,1.2,2.1,1.5],[0,1.6,1.1,2.2,1.2],[.2,-3.4,1.4,1.1,1.0]];
  for(const [cx,cz,sx,sz,rise] of shelves){
    const distance=((x-cx)/sx)**2+((z-cz)/sz)**2;
    height+=rise*Math.exp(-distance*distance*1.2);
  }
  return height+.12*Math.sin(x*2.7+Math.sin(z*1.3))*.7+.09*Math.sin(z*4.1+x*1.9);
}
