/** Shared cutaway-water boundary for rock and marine-life transmission. */
export const WATER_RADIUS_X=11.9;
export const WATER_RADIUS_Z=10.5;
export const underwaterPathGLSL=`
  float underwaterPath(vec2 localXZ,float depth,vec3 towardEye) {
    vec3 ray=normalize(towardEye);
    vec2 p=localXZ/vec2(${WATER_RADIUS_X},${WATER_RADIUS_Z});
    vec2 d=ray.xz/vec2(${WATER_RADIUS_X},${WATER_RADIUS_Z});
    float c=dot(p,p)-1.;
    // The feathered cutaway retains a thin optical layer at its open edge.
    float edgeLayer=depth*.4;
    if(c>=0.)return edgeLayer;
    float top=ray.y>.001?depth/ray.y:100.;
    float a=dot(d,d),b=2.*dot(p,d);
    float side=a>.000001?(-b+sqrt(max(0.,b*b-4.*a*c)))/(2.*a):100.;
    return max(edgeLayer,min(top,side));
  }
`;
