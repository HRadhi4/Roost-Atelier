import{A as Fe,B as an,C as ln,D as Zt,E as mt,F as yt,I as At,L as fn,M as un,N as pn,O as $t,P as Jt,W as j,Y as N,a as Ee,f as De,fa as W,g as rn,h as cn,hb as J,ka as ct,la as X,na as gt,ra as Qt,sa as dn,va as zt,w as rt,z as Ne}from"./chunk-I6E2ZZMT.js";import{c as ui}from"./chunk-NM6J3ND7.js";var wt=Math.pow(2,-24),Ct=Symbol("SKIP_GENERATION"),jt={strategy:0,maxDepth:40,targetLeafSize:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null,[Ct]:!1};var $=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(t,e){let n=1/0,i=-1/0;for(let r=0,s=t.length;r<s;r++){let c=t[r][e];n=c<n?c:n,i=c>i?c:i}this.min=n,this.max=i}setFromPoints(t,e){let n=1/0,i=-1/0;for(let r=0,s=e.length;r<s;r++){let a=e[r],c=t.dot(a);n=c<n?c:n,i=c>i?c:i}this.min=n,this.max=i}isSeparated(t){return this.min>t.max||t.min>this.max}};$.prototype.setFromBox=function(){let o=new N;return function(e,n){let i=n.min,r=n.max,s=1/0,a=-1/0;for(let c=0;c<=1;c++)for(let p=0;p<=1;p++)for(let u=0;u<=1;u++){o.x=i.x*c+r.x*(1-c),o.y=i.y*p+r.y*(1-p),o.z=i.z*u+r.z*(1-u);let f=e.dot(o);s=Math.min(f,s),a=Math.max(f,a)}this.min=s,this.max=a}}();var pi=function(){let o=new N,t=new N,e=new N;return function(i,r,s){let a=i.start,c=o,p=r.start,u=t;e.subVectors(a,p),o.subVectors(i.end,i.start),t.subVectors(r.end,r.start);let f=e.dot(u),l=u.dot(c),d=u.dot(u),T=e.dot(c),A=c.dot(c)*d-l*l,g,m;A!==0?g=(f*l-T*d)/A:g=0,m=(f+g*l)/d,s.x=g,s.y=m}}(),Ut=function(){let o=new j,t=new N,e=new N;return function(i,r,s,a){pi(i,r,o);let c=o.x,p=o.y;if(c>=0&&c<=1&&p>=0&&p<=1){i.at(c,s),r.at(p,a);return}else if(c>=0&&c<=1){p<0?r.at(0,a):r.at(1,a),i.closestPointToPoint(a,!0,s);return}else if(p>=0&&p<=1){c<0?i.at(0,s):i.at(1,s),r.closestPointToPoint(s,!0,a);return}else{let u;c<0?u=i.start:u=i.end;let f;p<0?f=r.start:f=r.end;let l=t,d=e;if(i.closestPointToPoint(f,!0,t),r.closestPointToPoint(u,!0,e),l.distanceToSquared(f)<=d.distanceToSquared(u)){s.copy(l),a.copy(f);return}else{s.copy(u),a.copy(d);return}}}}(),mn=function(){let o=new N,t=new N,e=new Qt,n=new J;return function(r,s){let{radius:a,center:c}=r,{a:p,b:u,c:f}=s;if(n.start=p,n.end=u,n.closestPointToPoint(c,!0,o).distanceTo(c)<=a||(n.start=p,n.end=f,n.closestPointToPoint(c,!0,o).distanceTo(c)<=a)||(n.start=u,n.end=f,n.closestPointToPoint(c,!0,o).distanceTo(c)<=a))return!0;let v=s.getPlane(e);if(Math.abs(v.distanceToPoint(c))<=a){let g=v.projectPoint(c,t);if(s.containsPoint(g))return!0}return!1}}();var di=["x","y","z"],ot=1e-15,yn=ot*ot;function Q(o){return Math.abs(o)<ot}var G=class extends ct{constructor(...t){super(...t),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new N),this.satBounds=new Array(4).fill().map(()=>new $),this.points=[this.a,this.b,this.c],this.plane=new Qt,this.isDegenerateIntoSegment=!1,this.isDegenerateIntoPoint=!1,this.degenerateSegment=new J,this.needsUpdate=!0}intersectsSphere(t){return mn(t,this)}update(){let t=this.a,e=this.b,n=this.c,i=this.points,r=this.satAxes,s=this.satBounds,a=r[0],c=s[0];this.getNormal(a),c.setFromPoints(a,i);let p=r[1],u=s[1];p.subVectors(t,e),u.setFromPoints(p,i);let f=r[2],l=s[2];f.subVectors(e,n),l.setFromPoints(f,i);let d=r[3],T=s[3];d.subVectors(n,t),T.setFromPoints(d,i);let v=p.length(),A=f.length(),g=d.length();this.isDegenerateIntoPoint=!1,this.isDegenerateIntoSegment=!1,v<ot?A<ot||g<ot?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(t),this.degenerateSegment.end.copy(n)):A<ot?g<ot?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(e),this.degenerateSegment.end.copy(t)):g<ot&&(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(n),this.degenerateSegment.end.copy(e)),this.plane.setFromNormalAndCoplanarPoint(a,t),this.needsUpdate=!1}};G.prototype.closestPointToSegment=function(){let o=new N,t=new N,e=new J;return function(i,r=null,s=null){this.needsUpdate&&this.update();let{start:a,end:c}=i,p=this.points,u,f=1/0,l=this.plane.distanceToPoint(a),d=this.plane.distanceToPoint(c);if(l*d<0&&this.plane.intersectLine(i,o)!==null&&this.containsPoint(o))return r&&r.copy(o),s&&s.copy(o),0;for(let T=0;T<3;T++){let v=(T+1)%3;e.start.copy(p[T]),e.end.copy(p[v]),Ut(e,i,o,t),u=o.distanceToSquared(t),u<f&&(f=u,r&&r.copy(o),s&&s.copy(t))}return this.closestPointToPoint(a,o),u=a.distanceToSquared(o),u<f&&(f=u,r&&r.copy(o),s&&s.copy(a)),this.closestPointToPoint(c,o),u=c.distanceToSquared(o),u<f&&(f=u,r&&r.copy(o),s&&s.copy(c)),Math.sqrt(f)}}();G.prototype.intersectsTriangle=function(){let o=new G,t=new $,e=new $,n=new N,i=new N,r=new N,s=new N,a=new J,c=new J,p=new N,u=new j,f=new j;function l(x,y,h,S){let _=n;!x.isDegenerateIntoPoint&&!x.isDegenerateIntoSegment?_.copy(x.plane.normal):_.copy(y.plane.normal);let B=x.satBounds,P=x.satAxes;for(let w=1;w<4;w++){let E=B[w],D=P[w];if(t.setFromPoints(D,y.points),E.isSeparated(t)||(s.copy(_).cross(D),t.setFromPoints(s,x.points),e.setFromPoints(s,y.points),t.isSeparated(e)))return!1}let b=y.satBounds,I=y.satAxes;for(let w=1;w<4;w++){let E=b[w],D=I[w];if(t.setFromPoints(D,x.points),E.isSeparated(t)||(s.crossVectors(_,D),t.setFromPoints(s,x.points),e.setFromPoints(s,y.points),t.isSeparated(e)))return!1}return h&&(S||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),h.start.set(0,0,0),h.end.set(0,0,0)),!0}function d(x,y,h,S,_,B,P,b,I,w,E){let D=P/(P-b);w.x=S+(_-S)*D,E.start.subVectors(y,x).multiplyScalar(D).add(x),D=P/(P-I),w.y=S+(B-S)*D,E.end.subVectors(h,x).multiplyScalar(D).add(x)}function T(x,y,h,S,_,B,P,b,I,w,E){if(_>0)d(x.c,x.a,x.b,S,y,h,I,P,b,w,E);else if(B>0)d(x.b,x.a,x.c,h,y,S,b,P,I,w,E);else if(b*I>0||P!=0)d(x.a,x.b,x.c,y,h,S,P,b,I,w,E);else if(b!=0)d(x.b,x.a,x.c,h,y,S,b,P,I,w,E);else if(I!=0)d(x.c,x.a,x.b,S,y,h,I,P,b,w,E);else return!0;return!1}function v(x,y,h,S){let _=y.degenerateSegment,B=x.plane.distanceToPoint(_.start),P=x.plane.distanceToPoint(_.end);return Q(B)?Q(P)?l(x,y,h,S):(h&&(h.start.copy(_.start),h.end.copy(_.start)),x.containsPoint(_.start)):Q(P)?(h&&(h.start.copy(_.end),h.end.copy(_.end)),x.containsPoint(_.end)):x.plane.intersectLine(_,n)!=null?(h&&(h.start.copy(n),h.end.copy(n)),x.containsPoint(n)):!1}function A(x,y,h){let S=y.a;return Q(x.plane.distanceToPoint(S))&&x.containsPoint(S)?(h&&(h.start.copy(S),h.end.copy(S)),!0):!1}function g(x,y,h){let S=x.degenerateSegment,_=y.a;return S.closestPointToPoint(_,!0,n),_.distanceToSquared(n)<yn?(h&&(h.start.copy(_),h.end.copy(_)),!0):!1}function m(x,y,h,S){if(x.isDegenerateIntoSegment)if(y.isDegenerateIntoSegment){let _=x.degenerateSegment,B=y.degenerateSegment,P=i,b=r;_.delta(P),B.delta(b);let I=n.subVectors(B.start,_.start),w=P.x*b.y-P.y*b.x;if(Q(w))return!1;let E=(I.x*b.y-I.y*b.x)/w,D=-(P.x*I.y-P.y*I.x)/w;if(E<0||E>1||D<0||D>1)return!1;let F=_.start.z+P.z*E,U=B.start.z+b.z*D;return Q(F-U)?(h&&(h.start.copy(_.start).addScaledVector(P,E),h.end.copy(_.start).addScaledVector(P,E)),!0):!1}else return y.isDegenerateIntoPoint?g(x,y,h):v(y,x,h,S);else{if(x.isDegenerateIntoPoint)return y.isDegenerateIntoPoint?y.a.distanceToSquared(x.a)<yn?(h&&(h.start.copy(x.a),h.end.copy(x.a)),!0):!1:y.isDegenerateIntoSegment?g(y,x,h):A(y,x,h);if(y.isDegenerateIntoPoint)return A(x,y,h);if(y.isDegenerateIntoSegment)return v(x,y,h,S)}}return function(y,h=null,S=!1){this.needsUpdate&&this.update(),y.isExtendedTriangle?y.needsUpdate&&y.update():(o.copy(y),o.update(),y=o);let _=m(this,y,h,S);if(_!==void 0)return _;let B=this.plane,P=y.plane,b=P.distanceToPoint(this.a),I=P.distanceToPoint(this.b),w=P.distanceToPoint(this.c);Q(b)&&(b=0),Q(I)&&(I=0),Q(w)&&(w=0);let E=b*I,D=b*w;if(E>0&&D>0)return!1;let F=B.distanceToPoint(y.a),U=B.distanceToPoint(y.b),st=B.distanceToPoint(y.c);Q(F)&&(F=0),Q(U)&&(U=0),Q(st)&&(st=0);let Rt=F*U,Ot=F*st;if(Rt>0&&Ot>0)return!1;i.copy(B.normal),r.copy(P.normal);let Se=i.cross(r),Be=0,Pe=Math.abs(Se.x),sn=Math.abs(Se.y);sn>Pe&&(Pe=sn,Be=1),Math.abs(Se.z)>Pe&&(Be=2);let vt=di[Be],si=this.a[vt],ri=this.b[vt],ci=this.c[vt],ai=y.a[vt],li=y.b[vt],fi=y.c[vt];if(T(this,si,ri,ci,E,D,b,I,w,u,a))return l(this,y,h,S);if(T(y,ai,li,fi,Rt,Ot,F,U,st,f,c))return l(this,y,h,S);if(u.y<u.x){let Ie=u.y;u.y=u.x,u.x=Ie,p.copy(a.start),a.start.copy(a.end),a.end.copy(p)}if(f.y<f.x){let Ie=f.y;f.y=f.x,f.x=Ie,p.copy(c.start),c.start.copy(c.end),c.end.copy(p)}return u.y<f.x||f.y<u.x?!1:(h&&(f.x>u.x?h.start.copy(c.start):h.start.copy(a.start),f.y<u.y?h.end.copy(c.end):h.end.copy(a.end)),!0)}}();G.prototype.distanceToPoint=function(){let o=new N;return function(e){return this.closestPointToPoint(e,o),e.distanceTo(o)}}();G.prototype.distanceToTriangle=function(){let o=new N,t=new N,e=["a","b","c"],n=new J,i=new J;return function(s,a=null,c=null){let p=a||c?n:null;if(this.intersectsTriangle(s,p,!0))return(a||c)&&(a&&p.getCenter(a),c&&p.getCenter(c)),0;let u=1/0;for(let f=0;f<3;f++){let l,d=e[f],T=s[d];this.closestPointToPoint(T,o),l=T.distanceToSquared(o),l<u&&(u=l,a&&a.copy(o),c&&c.copy(T));let v=this[d];s.closestPointToPoint(v,o),l=v.distanceToSquared(o),l<u&&(u=l,a&&a.copy(v),c&&c.copy(o))}for(let f=0;f<3;f++){let l=e[f],d=e[(f+1)%3];n.set(this[l],this[d]);for(let T=0;T<3;T++){let v=e[T],A=e[(T+1)%3];i.set(s[v],s[A]),Ut(n,i,o,t);let g=o.distanceToSquared(t);g<u&&(u=g,a&&a.copy(o),c&&c.copy(t))}}return Math.sqrt(u)}}();var k=class{constructor(t,e,n){this.isOrientedBox=!0,this.min=new N,this.max=new N,this.matrix=new W,this.invMatrix=new W,this.points=new Array(8).fill().map(()=>new N),this.satAxes=new Array(3).fill().map(()=>new N),this.satBounds=new Array(3).fill().map(()=>new $),this.alignedSatBounds=new Array(3).fill().map(()=>new $),this.needsUpdate=!1,t&&this.min.copy(t),e&&this.max.copy(e),n&&this.matrix.copy(n)}set(t,e,n){this.min.copy(t),this.max.copy(e),this.matrix.copy(n),this.needsUpdate=!0}copy(t){this.min.copy(t.min),this.max.copy(t.max),this.matrix.copy(t.matrix),this.needsUpdate=!0}};k.prototype.update=function(){return function(){let t=this.matrix,e=this.min,n=this.max,i=this.points;for(let p=0;p<=1;p++)for(let u=0;u<=1;u++)for(let f=0;f<=1;f++){let l=1*p|2*u|4*f,d=i[l];d.x=p?n.x:e.x,d.y=u?n.y:e.y,d.z=f?n.z:e.z,d.applyMatrix4(t)}let r=this.satBounds,s=this.satAxes,a=i[0];for(let p=0;p<3;p++){let u=s[p],f=r[p],l=1<<p,d=i[l];u.subVectors(a,d),f.setFromPoints(u,i)}let c=this.alignedSatBounds;c[0].setFromPointsField(i,"x"),c[1].setFromPointsField(i,"y"),c[2].setFromPointsField(i,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}}();k.prototype.intersectsBox=function(){let o=new $;return function(e){this.needsUpdate&&this.update();let n=e.min,i=e.max,r=this.satBounds,s=this.satAxes,a=this.alignedSatBounds;if(o.min=n.x,o.max=i.x,a[0].isSeparated(o)||(o.min=n.y,o.max=i.y,a[1].isSeparated(o))||(o.min=n.z,o.max=i.z,a[2].isSeparated(o)))return!1;for(let c=0;c<3;c++){let p=s[c],u=r[c];if(o.setFromBox(p,e),u.isSeparated(o))return!1}return!0}}();k.prototype.intersectsTriangle=function(){let o=new G,t=new Array(3),e=new $,n=new $,i=new N;return function(s){this.needsUpdate&&this.update(),s.isExtendedTriangle?s.needsUpdate&&s.update():(o.copy(s),o.update(),s=o);let a=this.satBounds,c=this.satAxes;t[0]=s.a,t[1]=s.b,t[2]=s.c;for(let l=0;l<3;l++){let d=a[l],T=c[l];if(e.setFromPoints(T,t),d.isSeparated(e))return!1}let p=s.satBounds,u=s.satAxes,f=this.points;for(let l=0;l<3;l++){let d=p[l],T=u[l];if(e.setFromPoints(T,f),d.isSeparated(e))return!1}for(let l=0;l<3;l++){let d=c[l];for(let T=0;T<4;T++){let v=u[T];if(i.crossVectors(d,v),e.setFromPoints(i,t),n.setFromPoints(i,f),e.isSeparated(n))return!1}}return!0}}();k.prototype.closestPointToPoint=function(){return function(t,e){return this.needsUpdate&&this.update(),e.copy(t).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),e}}();k.prototype.distanceToPoint=function(){let o=new N;return function(e){return this.closestPointToPoint(e,o),e.distanceTo(o)}}();k.prototype.distanceToBox=function(){let o=["x","y","z"],t=new Array(12).fill().map(()=>new J),e=new Array(12).fill().map(()=>new J),n=new N,i=new N;return function(s,a=0,c=null,p=null){if(this.needsUpdate&&this.update(),this.intersectsBox(s))return(c||p)&&(s.getCenter(i),this.closestPointToPoint(i,n),s.closestPointToPoint(n,i),c&&c.copy(n),p&&p.copy(i)),0;let u=a*a,f=s.min,l=s.max,d=this.points,T=1/0;for(let A=0;A<8;A++){let g=d[A];i.copy(g).clamp(f,l);let m=g.distanceToSquared(i);if(m<T&&(T=m,c&&c.copy(g),p&&p.copy(i),m<u))return Math.sqrt(m)}let v=0;for(let A=0;A<3;A++)for(let g=0;g<=1;g++)for(let m=0;m<=1;m++){let x=(A+1)%3,y=(A+2)%3,h=g<<x|m<<y,S=1<<A|g<<x|m<<y,_=d[h],B=d[S];t[v].set(_,B);let b=o[A],I=o[x],w=o[y],E=e[v],D=E.start,F=E.end;D[b]=f[b],D[I]=g?f[I]:l[I],D[w]=m?f[w]:l[w],F[b]=l[b],F[I]=g?f[I]:l[I],F[w]=m?f[w]:l[w],v++}for(let A=0;A<=1;A++)for(let g=0;g<=1;g++)for(let m=0;m<=1;m++){i.x=A?l.x:f.x,i.y=g?l.y:f.y,i.z=m?l.z:f.z,this.closestPointToPoint(i,n);let x=i.distanceToSquared(n);if(x<T&&(T=x,c&&c.copy(n),p&&p.copy(i),x<u))return Math.sqrt(x)}for(let A=0;A<12;A++){let g=t[A];for(let m=0;m<12;m++){let x=e[m];Ut(g,x,n,i);let y=n.distanceToSquared(i);if(y<T&&(T=y,c&&c.copy(n),p&&p.copy(i),y<u))return Math.sqrt(y)}}return Math.sqrt(T)}}();var at=class{constructor(t){this._getNewPrimitive=t,this._primitives=[]}getPrimitive(){let t=this._primitives;return t.length===0?this._getNewPrimitive():t.pop()}releasePrimitive(t){this._primitives.push(t)}};var Me=class extends at{constructor(){super(()=>new G)}},K=new Me;var Vt=new N,Le=new N;function xn(o,t,e={},n=0,i=1/0){let r=n*n,s=i*i,a=1/0,c=null;if(o.shapecast({boundsTraverseOrder:u=>(Vt.copy(t).clamp(u.min,u.max),Vt.distanceToSquared(t)),intersectsBounds:(u,f,l)=>l<a&&l<s,intersectsTriangle:(u,f)=>{u.closestPointToPoint(t,Vt);let l=t.distanceToSquared(Vt);return l<a&&(Le.copy(Vt),a=l,c=f),l<r}}),a===1/0)return null;let p=Math.sqrt(a);return e.point?e.point.copy(Le):e.point=Le.clone(),e.distance=p,e.faceIndex=c,e}function L(o,t){return t[o+15]===65535}function R(o,t){return t[o+6]}function C(o,t){return t[o+14]}function O(o){return o+8}function z(o,t){let e=t[o+6];return o+e*8}function lt(o,t){return t[o+7]}var te=parseInt(Ee)>=169,yi=parseInt(Ee)<=161,xt=new N,ht=new N,Tt=new N,ee=new j,ne=new j,ie=new j,hn=new N,Tn=new N,vn=new N,Ht=new N;function xi(o,t,e,n,i,r,s,a){let c;if(r===rn?c=o.intersectTriangle(n,e,t,!0,i):c=o.intersectTriangle(t,e,n,r!==cn,i),c===null)return null;let p=o.origin.distanceTo(i);return p<s||p>a?null:{distance:p,point:i.clone()}}function An(o,t,e,n,i,r,s,a,c,p,u){xt.fromBufferAttribute(t,r),ht.fromBufferAttribute(t,s),Tt.fromBufferAttribute(t,a);let f=xi(o,xt,ht,Tt,Ht,c,p,u);if(f){if(n){ee.fromBufferAttribute(n,r),ne.fromBufferAttribute(n,s),ie.fromBufferAttribute(n,a),f.uv=new j;let d=ct.getInterpolation(Ht,xt,ht,Tt,ee,ne,ie,f.uv);te||(f.uv=d)}if(i){ee.fromBufferAttribute(i,r),ne.fromBufferAttribute(i,s),ie.fromBufferAttribute(i,a),f.uv1=new j;let d=ct.getInterpolation(Ht,xt,ht,Tt,ee,ne,ie,f.uv1);te||(f.uv1=d),yi&&(f.uv2=f.uv1)}if(e){hn.fromBufferAttribute(e,r),Tn.fromBufferAttribute(e,s),vn.fromBufferAttribute(e,a),f.normal=new N;let d=ct.getInterpolation(Ht,xt,ht,Tt,hn,Tn,vn,f.normal);f.normal.dot(o.direction)>0&&f.normal.multiplyScalar(-1),te||(f.normal=d)}let l={a:r,b:s,c:a,normal:new N,materialIndex:0};if(ct.getNormal(xt,ht,Tt,l.normal),f.face=l,f.faceIndex=r,te){let d=new N;ct.getBarycoord(Ht,xt,ht,Tt,d),f.barycoord=d}}return f}function gn(o){return o&&o.isMaterial?o.side:o}function bt(o,t,e,n,i,r,s){let a=n*3,c=a+0,p=a+1,u=a+2,{index:f,groups:l}=o;o.index&&(c=f.getX(c),p=f.getX(p),u=f.getX(u));let{position:d,normal:T,uv:v,uv1:A}=o.attributes;if(Array.isArray(t)){let g=n*3;for(let m=0,x=l.length;m<x;m++){let{start:y,count:h,materialIndex:S}=l[m];if(g>=y&&g<y+h){let _=gn(t[S]),B=An(e,d,T,v,A,c,p,u,_,r,s);if(B)if(B.faceIndex=n,B.face.materialIndex=S,i)i.push(B);else return B}}}else{let g=gn(t),m=An(e,d,T,v,A,c,p,u,g,r,s);if(m)if(m.faceIndex=n,m.face.materialIndex=0,i)i.push(m);else return m}return null}function V(o,t,e,n){let i=o.a,r=o.b,s=o.c,a=t,c=t+1,p=t+2;e&&(a=e.getX(a),c=e.getX(c),p=e.getX(p)),i.x=n.getX(a),i.y=n.getY(a),i.z=n.getZ(a),r.x=n.getX(c),r.y=n.getY(c),r.z=n.getZ(c),s.x=n.getX(p),s.y=n.getY(p),s.z=n.getZ(p)}function wn(o,t,e,n,i,r,s,a){let{geometry:c,_indirectBuffer:p}=o;for(let u=n,f=n+i;u<f;u++)bt(c,t,e,u,r,s,a)}function bn(o,t,e,n,i,r,s){let{geometry:a,_indirectBuffer:c}=o,p=1/0,u=null;for(let f=n,l=n+i;f<l;f++){let d;d=bt(a,t,e,f,null,r,s),d&&d.distance<p&&(u=d,p=d.distance)}return u}function _n(o,t,e,n,i,r,s){let{geometry:a}=e,{index:c}=a,p=a.attributes.position;for(let u=o,f=t+o;u<f;u++){let l;if(l=u,V(s,l*3,c,p),s.needsUpdate=!0,n(s,l,i,r))return!0}return!1}function Sn(o,t=null){t&&Array.isArray(t)&&(t=new Set(t));let e=o.geometry,n=e.index?e.index.array:null,i=e.attributes.position,r,s,a,c,p=0,u=o._roots;for(let l=0,d=u.length;l<d;l++)r=u[l],s=new Uint32Array(r),a=new Uint16Array(r),c=new Float32Array(r),f(0,p),p+=r.byteLength;function f(l,d,T=!1){let v=l*2;if(L(v,a)){let A=R(l,s),g=C(v,a),m=1/0,x=1/0,y=1/0,h=-1/0,S=-1/0,_=-1/0;for(let B=3*A,P=3*(A+g);B<P;B++){let b=n[B],I=i.getX(b),w=i.getY(b),E=i.getZ(b);I<m&&(m=I),I>h&&(h=I),w<x&&(x=w),w>S&&(S=w),E<y&&(y=E),E>_&&(_=E)}return c[l+0]!==m||c[l+1]!==x||c[l+2]!==y||c[l+3]!==h||c[l+4]!==S||c[l+5]!==_?(c[l+0]=m,c[l+1]=x,c[l+2]=y,c[l+3]=h,c[l+4]=S,c[l+5]=_,!0):!1}else{let A=O(l),g=z(l,s),m=T,x=!1,y=!1;if(t){if(!m){let b=A/8+d/32,I=g/8+d/32;x=t.has(b),y=t.has(I),m=!x&&!y}}else x=!0,y=!0;let h=m||x,S=m||y,_=!1;h&&(_=f(A,d,m));let B=!1;S&&(B=f(g,d,m));let P=_||B;if(P)for(let b=0;b<3;b++){let I=A+b,w=g+b,E=c[I],D=c[I+3],F=c[w],U=c[w+3];c[l+b]=E<F?E:F,c[l+b+3]=D>U?D:U}return P}}}function Y(o,t,e,n,i){let r,s,a,c,p,u,f=1/e.direction.x,l=1/e.direction.y,d=1/e.direction.z,T=e.origin.x,v=e.origin.y,A=e.origin.z,g=t[o],m=t[o+3],x=t[o+1],y=t[o+3+1],h=t[o+2],S=t[o+3+2];return f>=0?(r=(g-T)*f,s=(m-T)*f):(r=(m-T)*f,s=(g-T)*f),l>=0?(a=(x-v)*l,c=(y-v)*l):(a=(y-v)*l,c=(x-v)*l),r>c||a>s||((a>r||isNaN(r))&&(r=a),(c<s||isNaN(s))&&(s=c),d>=0?(p=(h-A)*d,u=(S-A)*d):(p=(S-A)*d,u=(h-A)*d),r>u||p>s)?!1:((p>r||r!==r)&&(r=p),(u<s||s!==s)&&(s=u),r<=i&&s>=n)}var Re=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let t=[],e=null;this.setBuffer=n=>{e&&t.push(e),e=n,this.float32Array=new Float32Array(n),this.uint16Array=new Uint16Array(n),this.uint32Array=new Uint32Array(n)},this.clearBuffer=()=>{e=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,t.length!==0&&this.setBuffer(t.pop())}}},M=new Re;function Bn(o,t,e,n,i,r,s,a){let{geometry:c,_indirectBuffer:p}=o;for(let u=n,f=n+i;u<f;u++){let l=p?p[u]:u;bt(c,t,e,l,r,s,a)}}function Pn(o,t,e,n,i,r,s){let{geometry:a,_indirectBuffer:c}=o,p=1/0,u=null;for(let f=n,l=n+i;f<l;f++){let d;d=bt(a,t,e,c?c[f]:f,null,r,s),d&&d.distance<p&&(u=d,p=d.distance)}return u}function In(o,t,e,n,i,r,s){let{geometry:a}=e,{index:c}=a,p=a.attributes.position;for(let u=o,f=t+o;u<f;u++){let l;if(l=e.resolveTriangleIndex(u),V(s,l*3,c,p),s.needsUpdate=!0,n(s,l,i,r))return!0}return!1}function En(o,t,e,n,i,r,s){M.setBuffer(o._roots[t]),Y(0,M.float32Array,n,r,s)&&Oe(0,o,e,n,i,r,s),M.clearBuffer()}function Oe(o,t,e,n,i,r,s){let{float32Array:a,uint16Array:c,uint32Array:p}=M,u=o*2;if(L(u,c)){let l=R(o,p),d=C(u,c);wn(t,e,n,l,d,i,r,s)}else{let l=O(o);Y(l,a,n,r,s)&&Oe(l,t,e,n,i,r,s);let d=z(o,p);Y(d,a,n,r,s)&&Oe(d,t,e,n,i,r,s)}}var hi=["x","y","z"];function Dn(o,t,e,n,i,r){M.setBuffer(o._roots[t]);let s=null;return Y(0,M.float32Array,n,i,r)&&(s=ze(0,o,e,n,i,r)),M.clearBuffer(),s}function ze(o,t,e,n,i,r){let{float32Array:s,uint16Array:a,uint32Array:c}=M,p=o*2;if(L(p,a)){let f=R(o,c),l=C(p,a);return bn(t,e,n,f,l,i,r)}else{let f=lt(o,c),l=hi[f],T=n.direction[l]>=0,v,A;T?(v=O(o),A=z(o,c)):(v=z(o,c),A=O(o));let m=Y(v,s,n,i,r)?ze(v,t,e,n,i,r):null;if(m){let h=m.point[l];if(T?h<=s[A+f]:h>=s[A+f+3])return m}let y=Y(A,s,n,i,r)?ze(A,t,e,n,i,r):null;return m&&y?m.distance<=y.distance?m:y:m||y||null}}function H(o,t,e){return e.min.x=t[o],e.min.y=t[o+1],e.min.z=t[o+2],e.max.x=t[o+3],e.max.y=t[o+4],e.max.z=t[o+5],e}function kt(o){let t=-1,e=-1/0;for(let n=0;n<3;n++){let i=o[n+3]-o[n];i>e&&(e=i,t=n)}return t}function Ce(o,t,e){for(let n=0;n<3;n++){let i=t[o+2*n],r=t[o+2*n+1],s=i-r,a=i+r;s<e[n]&&(e[n]=s),a>e[n+3]&&(e[n+3]=a)}}function oe(o){let t=o[3]-o[0],e=o[4]-o[1],n=o[5]-o[2];return 2*(t*e+e*n+n*t)}function qt(o){return o.index?o.index.count:o.attributes.position.count}function ft(o){return qt(o)/3}function Ue(o,t=ArrayBuffer){return o>65535?new Uint32Array(new t(4*o)):new Uint16Array(new t(2*o))}function Nn(o,t){if(!o.index){let e=o.attributes.position.count,n=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,i=Ue(e,n);o.setIndex(new gt(i,1));for(let r=0;r<e;r++)i[r]=r}}function Ti(o,t,e){let n=qt(o)/e,i=t||o.drawRange,r=i.start/e,s=(i.start+i.count)/e,a=Math.max(0,r),c=Math.min(n,s)-a;return{offset:Math.floor(a),count:Math.floor(c)}}function vi(o,t){return o.groups.map(e=>({offset:e.start/t,count:e.count/t}))}function Ve(o,t,e){let n=Ti(o,t,e),i=vi(o,e);if(!i.length)return[n];let r=[],s=n.offset,a=n.offset+n.count,c=qt(o)/e,p=[];for(let l of i){let{offset:d,count:T}=l,v=d,A=isFinite(T)?T:c-d,g=d+A;v<a&&g>s&&(p.push({pos:Math.max(s,v),isStart:!0}),p.push({pos:Math.min(a,g),isStart:!1}))}p.sort((l,d)=>l.pos!==d.pos?l.pos-d.pos:l.type==="end"?-1:1);let u=0,f=null;for(let l of p){let d=l.pos;u!==0&&d!==f&&r.push({offset:f,count:d-f}),u+=l.isStart?1:-1,f=d}return r}var se=new X,_t=new G,St=new G,Gt=new W,Fn=new k,re=new k;function Mn(o,t,e,n){M.setBuffer(o._roots[t]);let i=He(0,o,e,n);return M.clearBuffer(),i}function He(o,t,e,n,i=null){let{float32Array:r,uint16Array:s,uint32Array:a}=M,c=o*2;if(i===null&&(e.boundingBox||e.computeBoundingBox(),Fn.set(e.boundingBox.min,e.boundingBox.max,n),i=Fn),L(c,s)){let u=t.geometry,f=u.index,l=u.attributes.position,d=e.index,T=e.attributes.position,v=R(o,a),A=C(c,s);if(Gt.copy(n).invert(),e.boundsTree)return H(o,r,re),re.matrix.copy(Gt),re.needsUpdate=!0,e.boundsTree.shapecast({intersectsBounds:m=>re.intersectsBox(m),intersectsTriangle:m=>{m.a.applyMatrix4(n),m.b.applyMatrix4(n),m.c.applyMatrix4(n),m.needsUpdate=!0;for(let x=v*3,y=(A+v)*3;x<y;x+=3)if(V(St,x,f,l),St.needsUpdate=!0,m.intersectsTriangle(St))return!0;return!1}});{let g=ft(e);for(let m=v*3,x=(A+v)*3;m<x;m+=3){V(_t,m,f,l),_t.a.applyMatrix4(Gt),_t.b.applyMatrix4(Gt),_t.c.applyMatrix4(Gt),_t.needsUpdate=!0;for(let y=0,h=g*3;y<h;y+=3)if(V(St,y,d,T),St.needsUpdate=!0,_t.intersectsTriangle(St))return!0}}}else{let u=O(o),f=z(o,a);return H(u,r,se),!!(i.intersectsBox(se)&&He(u,t,e,n,i)||(H(f,r,se),i.intersectsBox(se)&&He(f,t,e,n,i)))}}var ae=new W,ke=new k,Xt=new k,Ai=new N,gi=new N,wi=new N,bi=new N;function Ln(o,t,e,n={},i={},r=0,s=1/0){t.boundingBox||t.computeBoundingBox(),ke.set(t.boundingBox.min,t.boundingBox.max,e),ke.needsUpdate=!0;let a=o.geometry,c=a.attributes.position,p=a.index,u=t.attributes.position,f=t.index,l=K.getPrimitive(),d=K.getPrimitive(),T=Ai,v=gi,A=null,g=null;i&&(A=wi,g=bi);let m=1/0,x=null,y=null;return ae.copy(e).invert(),Xt.matrix.copy(ae),o.shapecast({boundsTraverseOrder:h=>ke.distanceToBox(h),intersectsBounds:(h,S,_)=>_<m&&_<s?(S&&(Xt.min.copy(h.min),Xt.max.copy(h.max),Xt.needsUpdate=!0),!0):!1,intersectsRange:(h,S)=>{if(t.boundsTree)return t.boundsTree.shapecast({boundsTraverseOrder:B=>Xt.distanceToBox(B),intersectsBounds:(B,P,b)=>b<m&&b<s,intersectsRange:(B,P)=>{for(let b=B,I=B+P;b<I;b++){V(d,3*b,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let w=h,E=h+S;w<E;w++){V(l,3*w,p,c),l.needsUpdate=!0;let D=l.distanceToTriangle(d,T,A);if(D<m&&(v.copy(T),g&&g.copy(A),m=D,x=w,y=b),D<r)return!0}}}});{let _=ft(t);for(let B=0,P=_;B<P;B++){V(d,3*B,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let b=h,I=h+S;b<I;b++){V(l,3*b,p,c),l.needsUpdate=!0;let w=l.distanceToTriangle(d,T,A);if(w<m&&(v.copy(T),g&&g.copy(A),m=w,x=b,y=B),w<r)return!0}}}}}),K.releasePrimitive(l),K.releasePrimitive(d),m===1/0?null:(n.point?n.point.copy(v):n.point=v.clone(),n.distance=m,n.faceIndex=x,i&&(i.point?i.point.copy(g):i.point=g.clone(),i.point.applyMatrix4(ae),v.applyMatrix4(ae),i.distance=v.sub(i.point).length(),i.faceIndex=y),n)}function Rn(o,t=null){t&&Array.isArray(t)&&(t=new Set(t));let e=o.geometry,n=e.index?e.index.array:null,i=e.attributes.position,r,s,a,c,p=0,u=o._roots;for(let l=0,d=u.length;l<d;l++)r=u[l],s=new Uint32Array(r),a=new Uint16Array(r),c=new Float32Array(r),f(0,p),p+=r.byteLength;function f(l,d,T=!1){let v=l*2;if(L(v,a)){let A=R(l,s),g=C(v,a),m=1/0,x=1/0,y=1/0,h=-1/0,S=-1/0,_=-1/0;for(let B=A,P=A+g;B<P;B++){let b=3*o.resolveTriangleIndex(B);for(let I=0;I<3;I++){let w=b+I;w=n?n[w]:w;let E=i.getX(w),D=i.getY(w),F=i.getZ(w);E<m&&(m=E),E>h&&(h=E),D<x&&(x=D),D>S&&(S=D),F<y&&(y=F),F>_&&(_=F)}}return c[l+0]!==m||c[l+1]!==x||c[l+2]!==y||c[l+3]!==h||c[l+4]!==S||c[l+5]!==_?(c[l+0]=m,c[l+1]=x,c[l+2]=y,c[l+3]=h,c[l+4]=S,c[l+5]=_,!0):!1}else{let A=O(l),g=z(l,s),m=T,x=!1,y=!1;if(t){if(!m){let b=A/8+d/32,I=g/8+d/32;x=t.has(b),y=t.has(I),m=!x&&!y}}else x=!0,y=!0;let h=m||x,S=m||y,_=!1;h&&(_=f(A,d,m));let B=!1;S&&(B=f(g,d,m));let P=_||B;if(P)for(let b=0;b<3;b++){let I=A+b,w=g+b,E=c[I],D=c[I+3],F=c[w],U=c[w+3];c[l+b]=E<F?E:F,c[l+b+3]=D>U?D:U}return P}}}function On(o,t,e,n,i,r,s){M.setBuffer(o._roots[t]),Y(0,M.float32Array,n,r,s)&&qe(0,o,e,n,i,r,s),M.clearBuffer()}function qe(o,t,e,n,i,r,s){let{float32Array:a,uint16Array:c,uint32Array:p}=M,u=o*2;if(L(u,c)){let l=R(o,p),d=C(u,c);Bn(t,e,n,l,d,i,r,s)}else{let l=O(o);Y(l,a,n,r,s)&&qe(l,t,e,n,i,r,s);let d=z(o,p);Y(d,a,n,r,s)&&qe(d,t,e,n,i,r,s)}}var _i=["x","y","z"];function zn(o,t,e,n,i,r){M.setBuffer(o._roots[t]);let s=null;return Y(0,M.float32Array,n,i,r)&&(s=Ge(0,o,e,n,i,r)),M.clearBuffer(),s}function Ge(o,t,e,n,i,r){let{float32Array:s,uint16Array:a,uint32Array:c}=M,p=o*2;if(L(p,a)){let f=R(o,c),l=C(p,a);return Pn(t,e,n,f,l,i,r)}else{let f=lt(o,c),l=_i[f],T=n.direction[l]>=0,v,A;T?(v=O(o),A=z(o,c)):(v=z(o,c),A=O(o));let m=Y(v,s,n,i,r)?Ge(v,t,e,n,i,r):null;if(m){let h=m.point[l];if(T?h<=s[A+f]:h>=s[A+f+3])return m}let y=Y(A,s,n,i,r)?Ge(A,t,e,n,i,r):null;return m&&y?m.distance<=y.distance?m:y:m||y||null}}var le=new X,Bt=new G,Pt=new G,Yt=new W,Cn=new k,fe=new k;function Un(o,t,e,n){M.setBuffer(o._roots[t]);let i=Xe(0,o,e,n);return M.clearBuffer(),i}function Xe(o,t,e,n,i=null){let{float32Array:r,uint16Array:s,uint32Array:a}=M,c=o*2;if(i===null&&(e.boundingBox||e.computeBoundingBox(),Cn.set(e.boundingBox.min,e.boundingBox.max,n),i=Cn),L(c,s)){let u=t.geometry,f=u.index,l=u.attributes.position,d=e.index,T=e.attributes.position,v=R(o,a),A=C(c,s);if(Yt.copy(n).invert(),e.boundsTree)return H(o,r,fe),fe.matrix.copy(Yt),fe.needsUpdate=!0,e.boundsTree.shapecast({intersectsBounds:m=>fe.intersectsBox(m),intersectsTriangle:m=>{m.a.applyMatrix4(n),m.b.applyMatrix4(n),m.c.applyMatrix4(n),m.needsUpdate=!0;for(let x=v,y=A+v;x<y;x++)if(V(Pt,3*t.resolveTriangleIndex(x),f,l),Pt.needsUpdate=!0,m.intersectsTriangle(Pt))return!0;return!1}});{let g=ft(e);for(let m=v,x=A+v;m<x;m++){let y=t.resolveTriangleIndex(m);V(Bt,3*y,f,l),Bt.a.applyMatrix4(Yt),Bt.b.applyMatrix4(Yt),Bt.c.applyMatrix4(Yt),Bt.needsUpdate=!0;for(let h=0,S=g*3;h<S;h+=3)if(V(Pt,h,d,T),Pt.needsUpdate=!0,Bt.intersectsTriangle(Pt))return!0}}}else{let u=O(o),f=z(o,a);return H(u,r,le),!!(i.intersectsBox(le)&&Xe(u,t,e,n,i)||(H(f,r,le),i.intersectsBox(le)&&Xe(f,t,e,n,i)))}}var ue=new W,Ye=new k,Wt=new k,Si=new N,Bi=new N,Pi=new N,Ii=new N;function Vn(o,t,e,n={},i={},r=0,s=1/0){t.boundingBox||t.computeBoundingBox(),Ye.set(t.boundingBox.min,t.boundingBox.max,e),Ye.needsUpdate=!0;let a=o.geometry,c=a.attributes.position,p=a.index,u=t.attributes.position,f=t.index,l=K.getPrimitive(),d=K.getPrimitive(),T=Si,v=Bi,A=null,g=null;i&&(A=Pi,g=Ii);let m=1/0,x=null,y=null;return ue.copy(e).invert(),Wt.matrix.copy(ue),o.shapecast({boundsTraverseOrder:h=>Ye.distanceToBox(h),intersectsBounds:(h,S,_)=>_<m&&_<s?(S&&(Wt.min.copy(h.min),Wt.max.copy(h.max),Wt.needsUpdate=!0),!0):!1,intersectsRange:(h,S)=>{if(t.boundsTree){let _=t.boundsTree;return _.shapecast({boundsTraverseOrder:B=>Wt.distanceToBox(B),intersectsBounds:(B,P,b)=>b<m&&b<s,intersectsRange:(B,P)=>{for(let b=B,I=B+P;b<I;b++){let w=_.resolveTriangleIndex(b);V(d,3*w,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let E=h,D=h+S;E<D;E++){let F=o.resolveTriangleIndex(E);V(l,3*F,p,c),l.needsUpdate=!0;let U=l.distanceToTriangle(d,T,A);if(U<m&&(v.copy(T),g&&g.copy(A),m=U,x=E,y=b),U<r)return!0}}}})}else{let _=ft(t);for(let B=0,P=_;B<P;B++){V(d,3*B,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let b=h,I=h+S;b<I;b++){let w=o.resolveTriangleIndex(b);V(l,3*w,p,c),l.needsUpdate=!0;let E=l.distanceToTriangle(d,T,A);if(E<m&&(v.copy(T),g&&g.copy(A),m=E,x=b,y=B),E<r)return!0}}}}}),K.releasePrimitive(l),K.releasePrimitive(d),m===1/0?null:(n.point?n.point.copy(v):n.point=v.clone(),n.distance=m,n.faceIndex=x,i&&(i.point?i.point.copy(g):i.point=g.clone(),i.point.applyMatrix4(ue),v.applyMatrix4(ue),i.distance=v.sub(i.point).length(),i.faceIndex=y),n)}function We(o,t,e){return o===null?null:(o.point.applyMatrix4(t.matrixWorld),o.distance=o.point.distanceTo(e.ray.origin),o.object=t,o)}function Hn(){return typeof SharedArrayBuffer<"u"}function pe(o,t,e,n,i){let r=1/0,s=1/0,a=1/0,c=-1/0,p=-1/0,u=-1/0,f=1/0,l=1/0,d=1/0,T=-1/0,v=-1/0,A=-1/0,g=o.offset||0;for(let m=(t-g)*6,x=(t+e-g)*6;m<x;m+=6){let y=o[m+0],h=o[m+1],S=y-h,_=y+h;S<r&&(r=S),_>c&&(c=_),y<f&&(f=y),y>T&&(T=y);let B=o[m+2],P=o[m+3],b=B-P,I=B+P;b<s&&(s=b),I>p&&(p=I),B<l&&(l=B),B>v&&(v=B);let w=o[m+4],E=o[m+5],D=w-E,F=w+E;D<a&&(a=D),F>u&&(u=F),w<d&&(d=w),w>A&&(A=w)}n[0]=r,n[1]=s,n[2]=a,n[3]=c,n[4]=p,n[5]=u,i[0]=f,i[1]=l,i[2]=d,i[3]=T,i[4]=v,i[5]=A}var it=8,Ze=8,Ke=new Int32Array(it),nt=new Float32Array(it*6),It=new Float32Array(it*6),tt=new Float32Array(6),de=new Float32Array(6),ut=new Int32Array(Ze),qn=new Float32Array(Ze*6);function Di(o,t,e,n){for(let i=0;i<3;i++){let r=t[o+2*i],s=t[o+2*i+1],a=r-s,c=r+s;a<e[n+i]&&(e[n+i]=a),c>e[n+i+3]&&(e[n+i+3]=c)}}function Gn(o,t){let e=o[t+3]-o[t],n=o[t+4]-o[t+1],i=o[t+5]-o[t+2];return 2*(e*n+n*i+i*e)}function Xn(o,t,e,n,i,r){let s=-1,a=0;if(r===0)s=kt(t),s!==-1&&(a=(t[s]+t[s+3])/2);else if(r===1)s=kt(o),s!==-1&&(a=Ni(e,n,i,s));else if(r===2){let c=oe(o),p=1.25*i,u=e.offset||0,f=(n-u)*6,l=(n+i-u)*6;for(let d=0;d<3;d++){let T=t[d],g=(t[d+3]-T)/it;if(i<Ze){for(let m=0;m<i;m++){let x=f+m*6,y=e[x+2*d],h=m;for(;h>0&&e[ut[h-1]+2*d]>y;)ut[h]=ut[h-1],h--;ut[h]=x}for(let m=0;m<3;m++)tt[m]=1/0,tt[m+3]=-1/0,de[m]=1/0,de[m+3]=-1/0;for(let m=i-1;m>=0;m--)Ce(ut[m],e,de),qn.set(de,m*6);for(let m=0;m<i-1;m++){Ce(ut[m],e,tt);let x=e[ut[m+1]+2*d];if(e[ut[m]+2*d]===x)continue;let y=m+1,h=i-y,S=oe(tt)/c,_=Gn(qn,y*6)/c,B=1+1.25*(S*y+_*h);B<p&&(s=d,p=B,a=x)}}else{for(let y=0;y<it;y++){Ke[y]=0;for(let h=0;h<3;h++)nt[y*6+h]=1/0,nt[y*6+h+3]=-1/0}for(let y=f;y<l;y+=6){let _=~~((e[y+2*d]-T)/g);_>=it&&(_=it-1),Ke[_]++,Di(y,e,nt,_*6)}let m=(it-1)*6;for(let y=0;y<6;y++)It[m+y]=nt[m+y];for(let y=it-2;y>=0;y--){let h=y*6,S=h+6;for(let _=0;_<3;_++)It[h+_]=Math.min(nt[h+_],It[S+_]),It[h+_+3]=Math.max(nt[h+_+3],It[S+_+3])}let x=0;for(let y=0;y<it-1;y++){let h=y*6,S=Ke[y];if(S!==0)for(let I=0;I<3;I++)x===0?(tt[I]=nt[h+I],tt[I+3]=nt[h+I+3]):(tt[I]=Math.min(tt[I],nt[h+I]),tt[I+3]=Math.max(tt[I+3],nt[h+I+3]));x+=S;let _=0,B=0;x!==0&&(_=oe(tt)/c);let P=i-x;P!==0&&(B=Gn(It,h+6)/c);let b=1+1.25*(_*x+B*P);b<p&&(s=d,p=b,a=T+g+y*g)}}}}else console.warn(`BVH: Invalid build strategy value ${r} used.`);return{axis:s,pos:a}}function Ni(o,t,e,n){let i=0,r=o.offset;for(let s=t,a=t+e;s<a;s++)i+=o[(s-r)*6+n*2];return i/e}function Yn(o,t,e,n,i,r){let s=n,a=n+i-1,c=r.pos,p=r.axis*2,u=e.offset||0;for(;;){for(;s<=a&&e[(s-u)*6+p]<c;)s++;for(;s<=a&&e[(a-u)*6+p]>=c;)a--;if(s<a){for(let f=0;f<t;f++){let l=o[s*t+f];o[s*t+f]=o[a*t+f],o[a*t+f]=l}for(let f=0;f<6;f++){let l=s-u,d=a-u,T=e[l*6+f];e[l*6+f]=e[d*6+f],e[d*6+f]=T}s++,a--}else return s}}var Fi=Math.pow(2,32),Et=new Float32Array(6),me=new Float32Array(6);function Mi(o,t,e,n,i,r){let{maxDepth:s,verbose:a,targetLeafSize:c,_strictLeafSize:p=1/0,strategy:u,onProgress:f,useSharedArrayBuffer:l=!1}=i,d=o.primitiveBuffer,T=o.primitiveBufferStride,v=l?SharedArrayBuffer:ArrayBuffer,A=new v(32*Math.max(1,2*Math.ceil(n)-1)),g=new Float32Array(A),m=new Uint32Array(A),x=new Uint16Array(A),y=0,h=!1;return pe(t,e,n,Et,me),B(e,n,0),A.slice(0,y*32);function S(P){f&&f((P-r.offset)/r.count)}function _(P,b,I){let w=P*2;m[P+6]=b,x[w+14]=I,x[w+15]=65535,S(b+I)}function B(P,b,I){let w=y++,E=w*8;g.set(Et,E),!h&&I>=s&&(h=!0,a&&console.warn(`BVH: Max depth of ${s} reached when generating BVH. Consider increasing maxDepth.`));let D=b>p;if(b<=c&&!D||I>=s){_(E,P,b);return}let F=Xn(Et,me,t,P,b,u),U=F.axis===-1?-1:Yn(d,T,t,P,b,F);if(F.axis===-1||U===P||U===P+b){if(!D){_(E,P,b);return}F.axis=Math.max(0,kt(Et)),U=P+Math.max(1,Math.floor(b/2))}m[E+7]=F.axis;let st=U-P;pe(t,P,st,Et,me),B(P,st,I+1);let Rt=y-w;if(Rt>Fi)throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");m[E+6]=Rt;let Ot=b-st;pe(t,U,Ot,Et,me),B(U,Ot,I+1)}}function Wn(o,t){let e=o.getRootRanges(t.range),n=e[0],i=e[e.length-1],r={offset:n.offset,count:i.offset+i.count-n.offset},s=new Float32Array(6*r.count);s.offset=r.offset,o.computePrimitiveBounds(r.offset,r.count,s),o._roots=e.map(a=>Mi(o,s,a.offset,a.count,t,r))}var pt,Nt,Dt=[],ye=new at(()=>new X);function Kn(o,t,e,n,i,r){pt=ye.getPrimitive(),Nt=ye.getPrimitive(),Dt.push(pt,Nt),M.setBuffer(o._roots[t]);let s=$e(0,o.geometry,e,n,i,r);M.clearBuffer(),ye.releasePrimitive(pt),ye.releasePrimitive(Nt),Dt.pop(),Dt.pop();let a=Dt.length;return a>0&&(Nt=Dt[a-1],pt=Dt[a-2]),s}function $e(o,t,e,n,i=null,r=0,s=0){let{float32Array:a,uint16Array:c,uint32Array:p}=M,u=o*2;if(L(u,c)){let l=R(o,p),d=C(u,c);return H(o,a,pt),n(l,d,!1,s,r+o/8,pt)}else{let b=function(w){let{uint16Array:E,uint32Array:D}=M,F=w*2;for(;!L(F,E);)w=O(w),F=w*2;return R(w,D)},I=function(w){let{uint16Array:E,uint32Array:D}=M,F=w*2;for(;!L(F,E);)w=z(w,D),F=w*2;return R(w,D)+C(F,E)},l=O(o),d=z(o,p),T=l,v=d,A,g,m,x;if(i&&(m=pt,x=Nt,H(T,a,m),H(v,a,x),A=i(m),g=i(x),g<A)){T=d,v=l;let w=A;A=g,g=w,m=x}m||(m=pt,H(T,a,m));let y=L(T*2,c),h=e(m,y,A,s+1,r+T/8),S;if(h===2){let w=b(T),D=I(T)-w;S=n(w,D,!0,s+1,r+T/8,m)}else S=h&&$e(T,t,e,n,i,r,s+1);if(S)return!0;x=Nt,H(v,a,x);let _=L(v*2,c),B=e(x,_,g,s+1,r+v/8),P;if(B===2){let w=b(v),D=I(v)-w;P=n(w,D,!0,s+1,r+v/8,x)}else P=B&&$e(v,t,e,n,i,r,s+1);return!!P}}var Kt=new M.constructor,xe=new M.constructor,dt=new at(()=>new X),Ft=new X,Mt=new X,Je=new X,Qe=new X,je=!1;function Zn(o,t,e,n){if(je)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");je=!0;let i=o._roots,r=t._roots,s,a=0,c=0,p=new W().copy(e).invert();for(let u=0,f=i.length;u<f;u++){Kt.setBuffer(i[u]),c=0;let l=dt.getPrimitive();H(0,Kt.float32Array,l),l.applyMatrix4(p);for(let d=0,T=r.length;d<T&&(xe.setBuffer(r[d]),s=et(0,0,e,p,n,a,c,0,0,l),xe.clearBuffer(),c+=r[d].byteLength/32,!s);d++);if(dt.releasePrimitive(l),Kt.clearBuffer(),a+=i[u].byteLength/32,s)break}return je=!1,s}function et(o,t,e,n,i,r=0,s=0,a=0,c=0,p=null,u=!1){let f,l;u?(f=xe,l=Kt):(f=Kt,l=xe);let d=f.float32Array,T=f.uint32Array,v=f.uint16Array,A=l.float32Array,g=l.uint32Array,m=l.uint16Array,x=o*2,y=t*2,h=L(x,v),S=L(y,m),_=!1;if(S&&h)u?_=i(R(t,g),C(t*2,m),R(o,T),C(o*2,v),c,s+t/8,a,r+o/8):_=i(R(o,T),C(o*2,v),R(t,g),C(t*2,m),a,r+o/8,c,s+t/8);else if(S){let B=dt.getPrimitive();H(t,A,B),B.applyMatrix4(e);let P=O(o),b=z(o,T);H(P,d,Ft),H(b,d,Mt);let I=B.intersectsBox(Ft),w=B.intersectsBox(Mt);_=I&&et(t,P,n,e,i,s,r,c,a+1,B,!u)||w&&et(t,b,n,e,i,s,r,c,a+1,B,!u),dt.releasePrimitive(B)}else{let B=O(t),P=z(t,g);H(B,A,Je),H(P,A,Qe);let b=p.intersectsBox(Je),I=p.intersectsBox(Qe);if(b&&I)_=et(o,B,e,n,i,r,s,a,c+1,p,u)||et(o,P,e,n,i,r,s,a,c+1,p,u);else if(b)if(h)_=et(o,B,e,n,i,r,s,a,c+1,p,u);else{let w=dt.getPrimitive();w.copy(Je).applyMatrix4(e);let E=O(o),D=z(o,T);H(E,d,Ft),H(D,d,Mt);let F=w.intersectsBox(Ft),U=w.intersectsBox(Mt);_=F&&et(B,E,n,e,i,s,r,c,a+1,w,!u)||U&&et(B,D,n,e,i,s,r,c,a+1,w,!u),dt.releasePrimitive(w)}else if(I)if(h)_=et(o,P,e,n,i,r,s,a,c+1,p,u);else{let w=dt.getPrimitive();w.copy(Qe).applyMatrix4(e);let E=O(o),D=z(o,T);H(E,d,Ft),H(D,d,Mt);let F=w.intersectsBox(Ft),U=w.intersectsBox(Mt);_=F&&et(P,E,n,e,i,s,r,c,a+1,w,!u)||U&&et(P,D,n,e,i,s,r,c,a+1,w,!u),dt.releasePrimitive(w)}}return _}var he=new class{constructor(){let o=null,t=null,e=null,n=!1;this.root=null,this.buffer=null,this.uint32Array=null,this.uint16Array=null,this.setBVH=(r,s)=>{if(n)throw new Error("BVHTraversalHelper: cannot call setBVH during an active traversal.");this.root=s,this.buffer=o=r._roots[s],this.uint16Array=e=new Uint16Array(o),this.uint32Array=t=new Uint32Array(o)},this.reset=()=>{this.root=null,this.buffer=o=null,this.uint16Array=e=null,this.uint32Array=t=null},this.getRangeStart=r=>{let s=r*2;for(;!L(s,e);)r=O(r),s=r*2;return R(r,t)},this.getRangeEnd=r=>{let s=r*2;for(;!L(s,e);)r=z(r,t),s=r*2;return R(r,t)+C(s,e)};let i=(r,s,a)=>{let c=s*2,p=L(c,e);if(!r(a,p,s)&&!p){let f=O(s),l=z(s,t);i(r,f,a+1),i(r,l,a+1)}};this.traverseBuffer=r=>{if(n)throw new Error("BVHTraversalHelper: cannot start a traversal during an active traversal.");n=!0;try{i(r,0,0)}finally{n=!1}},this.traverse=r=>{this.traverseBuffer((s,a,c)=>{if(a){let p=c*2,u=t[c+6],f=e[p+14];return r(s,a,new Float32Array(o,c*4,6),u,f)}else{let p=lt(c,t);return r(s,a,new Float32Array(o,c*4,6),p)}})}}};var $n=new X,Lt=new Float32Array(6),Te=class{constructor(){this._roots=null,this.primitiveBuffer=null,this.primitiveBufferStride=null}init(t){t={...jt,...t},"maxLeafSize"in t&&(console.warn('BVH: "maxLeafSize" option has been deprecated. Use "targetLeafSize", instead.'),t={...t,targetLeafSize:t.maxLeafSize}),Wn(this,t)}getRootRanges(){throw new Error("BVH: getRootRanges() not implemented")}writePrimitiveBounds(){throw new Error("BVH: writePrimitiveBounds() not implemented")}writePrimitiveRangeBounds(t,e,n,i){let r=1/0,s=1/0,a=1/0,c=-1/0,p=-1/0,u=-1/0;for(let f=t,l=t+e;f<l;f++){this.writePrimitiveBounds(f,Lt,0);let[d,T,v,A,g,m]=Lt;d<r&&(r=d),A>c&&(c=A),T<s&&(s=T),g>p&&(p=g),v<a&&(a=v),m>u&&(u=m)}return n[i+0]=r,n[i+1]=s,n[i+2]=a,n[i+3]=c,n[i+4]=p,n[i+5]=u,n}computePrimitiveBounds(t,e,n){let i=n.offset||0;for(let r=t,s=t+e;r<s;r++){this.writePrimitiveBounds(r,Lt,0);let[a,c,p,u,f,l]=Lt,d=(a+u)/2,T=(c+f)/2,v=(p+l)/2,A=(u-a)/2,g=(f-c)/2,m=(l-p)/2,x=(r-i)*6;n[x+0]=d,n[x+1]=A+(Math.abs(d)+A)*wt,n[x+2]=T,n[x+3]=g+(Math.abs(T)+g)*wt,n[x+4]=v,n[x+5]=m+(Math.abs(v)+m)*wt}return n}shiftPrimitiveOffsets(t){let e=this._indirectBuffer;if(e)for(let n=0,i=e.length;n<i;n++)e[n]+=t;else{let n=this._roots;for(let i=0;i<n.length;i++){let r=n[i],s=new Uint32Array(r),a=new Uint16Array(r),c=r.byteLength/32;for(let p=0;p<c;p++){let u=8*p,f=2*u;L(f,a)&&(s[u+6]+=t)}}}}traverse(t,e=0){he.setBVH(this,e),he.traverse(t),he.reset()}refit(){let t=this._roots;for(let e=0,n=t.length;e<n;e++){let i=t[e],r=new Uint32Array(i),s=new Uint16Array(i),a=new Float32Array(i),c=i.byteLength/32;for(let p=c-1;p>=0;p--){let u=p*8,f=u*2;if(L(f,s)){let d=R(u,r),T=C(f,s);this.writePrimitiveRangeBounds(d,T,Lt,0),a.set(Lt,u)}else{let d=O(u),T=z(u,r);for(let v=0;v<3;v++){let A=a[d+v],g=a[d+v+3],m=a[T+v],x=a[T+v+3];a[u+v]=A<m?A:m,a[u+v+3]=g>x?g:x}}}}}getBoundingBox(t){return t.makeEmpty(),this._roots.forEach(n=>{H(0,new Float32Array(n),$n),t.union($n)}),t}shapecast(t){let{boundsTraverseOrder:e,intersectsBounds:n,intersectsRange:i,intersectsPrimitive:r,scratchPrimitive:s,iterate:a}=t;if(i&&r){let f=i;i=(l,d,T,v,A)=>f(l,d,T,v,A)?!0:a(l,d,this,r,T,v,s)}else i||(r?i=(f,l,d,T)=>a(f,l,this,r,d,T,s):i=(f,l,d)=>d);let c=!1,p=0,u=this._roots;for(let f=0,l=u.length;f<l;f++){let d=u[f];if(c=Kn(this,f,n,i,e,p),c)break;p+=d.byteLength/32}return c}bvhcast(t,e,n){let{intersectsRanges:i}=n;return Zn(this,t,e,i)}};function Ri(o,t){let e=o[o.length-1],n=e.offset+e.count>2**16,i=o.reduce((p,u)=>p+u.count,0),r=n?4:2,s=t?new SharedArrayBuffer(i*r):new ArrayBuffer(i*r),a=n?new Uint32Array(s):new Uint16Array(s),c=0;for(let p=0;p<o.length;p++){let{offset:u,count:f}=o[p];for(let l=0;l<f;l++)a[c+l]=u+l;c+=f}return a}var ve=class extends Te{get indirect(){return!!this._indirectBuffer}get primitiveStride(){return null}get primitiveBufferStride(){return this.indirect?1:this.primitiveStride}set primitiveBufferStride(t){}get primitiveBuffer(){return this.indirect?this._indirectBuffer:this.geometry.index.array}set primitiveBuffer(t){}constructor(t,e={}){if(t.isBufferGeometry){if(t.index&&t.index.isInterleavedBufferAttribute)throw new Error("BVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("BVH: Only BufferGeometries are supported.");if(e.useSharedArrayBuffer&&!Hn())throw new Error("BVH: SharedArrayBuffer is not available.");super(),this.geometry=t,this.resolvePrimitiveIndex=e.indirect?n=>this._indirectBuffer[n]:n=>n,this.primitiveBuffer=null,this.primitiveBufferStride=null,this._indirectBuffer=null,e={...jt,...e},e[Ct]||this.init(e)}init(t){let{geometry:e,primitiveStride:n}=this;if(t.indirect){let i=Ve(e,t.range,n),r=Ri(i,t.useSharedArrayBuffer);this._indirectBuffer=r}else Nn(e,t);super.init(t),!e.boundingBox&&t.setBoundingBox&&(e.boundingBox=this.getBoundingBox(new X))}getRootRanges(t){return this.indirect?[{offset:0,count:this._indirectBuffer.length}]:Ve(this.geometry,t,this.primitiveStride)}raycastObject3D(){throw new Error("BVH: raycastObject3D() not implemented")}};var Ae=new k,ge=new dn,Jn=new N,Qn=new W,jn=new N,tn=["getX","getY","getZ"],ti=class o extends ve{static serialize(t,e={}){e={cloneBuffers:!0,...e};let n=t.geometry,i=t._roots,r=t._indirectBuffer,s=n.getIndex(),a={version:1,roots:null,index:null,indirectBuffer:null};return e.cloneBuffers?(a.roots=i.map(c=>c.slice()),a.index=s?s.array.slice():null,a.indirectBuffer=r?r.slice():null):(a.roots=i,a.index=s?s.array:null,a.indirectBuffer=r),a}static deserialize(t,e,n={}){n={setIndex:!0,indirect:!!t.indirectBuffer,...n};let{index:i,roots:r,indirectBuffer:s}=t;t.version||(console.warn("MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data."),c(r));let a=new o(e,{...n,[Ct]:!0});if(a._roots=r,a._indirectBuffer=s||null,n.setIndex){let p=e.getIndex();if(p===null){let u=new gt(t.index,1,!1);e.setIndex(u)}else p.array!==i&&(p.array.set(i),p.needsUpdate=!0)}return a;function c(p){for(let u=0;u<p.length;u++){let f=p[u],l=new Uint32Array(f),d=new Uint16Array(f);for(let T=0,v=f.byteLength/32;T<v;T++){let A=8*T,g=2*A;L(g,d)||(l[A+6]=l[A+6]/8-T)}}}}get primitiveStride(){return 3}get resolveTriangleIndex(){return this.resolvePrimitiveIndex}constructor(t,e={}){e.maxLeafTris&&(console.warn('MeshBVH: "maxLeafTris" option has been deprecated. Use "targetLeafSize", instead.'),e={...e,targetLeafSize:e.maxLeafTris}),super(t,e)}shiftTriangleOffsets(t){return super.shiftPrimitiveOffsets(t)}writePrimitiveBounds(t,e,n){let i=this.geometry,r=this._indirectBuffer,s=i.attributes.position,a=i.index?i.index.array:null,p=(r?r[t]:t)*3,u=p+0,f=p+1,l=p+2;a&&(u=a[u],f=a[f],l=a[l]);for(let d=0;d<3;d++){let T=s[tn[d]](u),v=s[tn[d]](f),A=s[tn[d]](l),g=T;v<g&&(g=v),A<g&&(g=A);let m=T;v>m&&(m=v),A>m&&(m=A),e[n+d]=g,e[n+d+3]=m}return e}computePrimitiveBounds(t,e,n){let i=this.geometry,r=this._indirectBuffer,s=i.attributes.position,a=i.index?i.index.array:null,c=s.normalized;if(t<0||e+t-n.offset>n.length/6)throw new Error("MeshBVH: compute triangle bounds range is invalid.");let p=s.array,u=s.offset||0,f=3;s.isInterleavedBufferAttribute&&(f=s.data.stride);let l=["getX","getY","getZ"],d=n.offset;for(let T=t,v=t+e;T<v;T++){let g=(r?r[T]:T)*3,m=(T-d)*6,x=g+0,y=g+1,h=g+2;a&&(x=a[x],y=a[y],h=a[h]),c||(x=x*f+u,y=y*f+u,h=h*f+u);for(let S=0;S<3;S++){let _,B,P;c?(_=s[l[S]](x),B=s[l[S]](y),P=s[l[S]](h)):(_=p[x+S],B=p[y+S],P=p[h+S]);let b=_;B<b&&(b=B),P<b&&(b=P);let I=_;B>I&&(I=B),P>I&&(I=P);let w=(I-b)/2,E=S*2;n[m+E+0]=b+w,n[m+E+1]=w+(Math.abs(b)+w)*wt}}return n}raycastObject3D(t,e,n=[]){let{material:i}=t;if(i===void 0)return;Qn.copy(t.matrixWorld).invert(),ge.copy(e.ray).applyMatrix4(Qn),jn.setFromMatrixScale(t.matrixWorld),Jn.copy(ge.direction).multiply(jn);let r=Jn.length(),s=e.near/r,a=e.far/r;if(e.firstHitOnly===!0){let c=this.raycastFirst(ge,i,s,a);c=We(c,t,e),c&&n.push(c)}else{let c=this.raycast(ge,i,s,a);for(let p=0,u=c.length;p<u;p++){let f=We(c[p],t,e);f&&n.push(f)}}return n}refit(t=null){return(this.indirect?Rn:Sn)(this,t)}raycast(t,e=De,n=0,i=1/0){let r=this._roots,s=[],a=this.indirect?On:En;for(let c=0,p=r.length;c<p;c++)a(this,c,e,t,s,n,i);return s}raycastFirst(t,e=De,n=0,i=1/0){let r=this._roots,s=null,a=this.indirect?zn:Dn;for(let c=0,p=r.length;c<p;c++){let u=a(this,c,e,t,n,i);u!=null&&(s==null||u.distance<s.distance)&&(s=u)}return s}intersectsGeometry(t,e){let n=!1,i=this._roots,r=this.indirect?Un:Mn;for(let s=0,a=i.length;s<a&&(n=r(this,s,t,e),!n);s++);return n}shapecast(t){let e=K.getPrimitive(),n=super.shapecast({...t,intersectsPrimitive:t.intersectsTriangle,scratchPrimitive:e,iterate:this.indirect?In:_n});return K.releasePrimitive(e),n}bvhcast(t,e,n){let{intersectsRanges:i,intersectsTriangles:r}=n,s=K.getPrimitive(),a=this.geometry.index,c=this.geometry.attributes.position,p=this.indirect?T=>{let v=this.resolveTriangleIndex(T);V(s,v*3,a,c)}:T=>{V(s,T*3,a,c)},u=K.getPrimitive(),f=t.geometry.index,l=t.geometry.attributes.position,d=t.indirect?T=>{let v=t.resolveTriangleIndex(T);V(u,v*3,f,l)}:T=>{V(u,T*3,f,l)};if(r){if(!(t instanceof o))throw new Error('MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.');let T=(v,A,g,m,x,y,h,S)=>{for(let _=g,B=g+m;_<B;_++){d(_),u.a.applyMatrix4(e),u.b.applyMatrix4(e),u.c.applyMatrix4(e),u.needsUpdate=!0;for(let P=v,b=v+A;P<b;P++)if(p(P),s.needsUpdate=!0,r(s,u,P,_,x,y,h,S))return!0}return!1};if(i){let v=i;i=function(A,g,m,x,y,h,S,_){return v(A,g,m,x,y,h,S,_)?!0:T(A,g,m,x,y,h,S,_)}}else i=T}return super.bvhcast(t,e,{intersectsRanges:i})}intersectsBox(t,e){return Ae.set(t.min,t.max,e),Ae.needsUpdate=!0,this.shapecast({intersectsBounds:n=>Ae.intersectsBox(n),intersectsTriangle:n=>Ae.intersectsTriangle(n)})}intersectsSphere(t){return this.shapecast({intersectsBounds:e=>t.intersectsBox(e),intersectsTriangle:e=>e.intersectsSphere(t)})}closestPointToGeometry(t,e,n={},i={},r=0,s=1/0){return(this.indirect?Vn:Ln)(this,t,e,n,i,r,s)}closestPointToPoint(t,e={},n=0,i=1/0){return xn(this,t,e,n,i)}};function Oi(o){switch(o){case 1:return"R";case 2:return"RG";case 3:return"RGBA";case 4:return"RGBA"}throw new Error}function zi(o){switch(o){case 1:return fn;case 2:return pn;case 3:return At;case 4:return At}}function ei(o){switch(o){case 1:return un;case 2:return $t;case 3:return Jt;case 4:return Jt}}var we=class extends zt{constructor(){super(),this.minFilter=rt,this.magFilter=rt,this.generateMipmaps=!1,this.overrideItemSize=null,this._forcedType=null}updateFrom(t){let e=this.overrideItemSize,n=t.itemSize,i=t.count;if(e!==null){if(n*i%e!==0)throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");t.itemSize=e,t.count=i*n/e}let r=t.itemSize,s=t.count,a=t.normalized,c=t.array.constructor,p=c.BYTES_PER_ELEMENT,u=this._forcedType,f=r;if(u===null)switch(c){case Float32Array:u=yt;break;case Uint8Array:case Uint16Array:case Uint32Array:u=mt;break;case Int8Array:case Int16Array:case Int32Array:u=Zt;break}let l,d,T,v,A=Oi(r);switch(u){case yt:T=1,d=zi(r),a&&p===1?(v=c,A+="8",c===Uint8Array?l=Ne:(l=Fe,A+="_SNORM")):(v=Float32Array,A+="32F",l=yt);break;case Zt:A+=p*8+"I",T=a?Math.pow(2,c.BYTES_PER_ELEMENT*8-1):1,d=ei(r),p===1?(v=Int8Array,l=Fe):p===2?(v=Int16Array,l=an):(v=Int32Array,l=Zt);break;case mt:A+=p*8+"UI",T=a?Math.pow(2,c.BYTES_PER_ELEMENT*8-1):1,d=ei(r),p===1?(v=Uint8Array,l=Ne):p===2?(v=Uint16Array,l=ln):(v=Uint32Array,l=mt);break}f===3&&(d===At||d===Jt)&&(f=4);let g=Math.ceil(Math.sqrt(s))||1,m=f*g*g,x=new v(m),y=t.normalized;t.normalized=!1;for(let h=0;h<s;h++){let S=f*h;x[S]=t.getX(h)/T,r>=2&&(x[S+1]=t.getY(h)/T),r>=3&&(x[S+2]=t.getZ(h)/T,f===4&&(x[S+3]=1)),r>=4&&(x[S+3]=t.getW(h)/T)}t.normalized=y,this.internalFormat=A,this.format=d,this.type=l,this.image.width=g,this.image.height=g,this.image.data=x,this.needsUpdate=!0,this.dispose(),t.itemSize=n,t.count=i}},be=class extends we{constructor(){super(),this._forcedType=mt}};var _e=class extends we{constructor(){super(),this._forcedType=yt}};var ni=class{constructor(){this.index=new be,this.position=new _e,this.bvhBounds=new zt,this.bvhContents=new zt,this._cachedIndexAttr=null,this.index.overrideItemSize=3}updateFrom(t){let{geometry:e}=t;if(Ui(t,this.bvhBounds,this.bvhContents),this.position.updateFrom(e.attributes.position),t.indirect){let n=t._indirectBuffer;if(this._cachedIndexAttr===null||this._cachedIndexAttr.count!==n.length)if(e.index)this._cachedIndexAttr=e.index.clone();else{let i=Ue(qt(e));this._cachedIndexAttr=new gt(i,1,!1)}Ci(e,n,this._cachedIndexAttr),this.index.updateFrom(this._cachedIndexAttr)}else this.index.updateFrom(e.index)}dispose(){let{index:t,position:e,bvhBounds:n,bvhContents:i}=this;t&&t.dispose(),e&&e.dispose(),n&&n.dispose(),i&&i.dispose()}};function Ci(o,t,e){let n=e.array,i=o.index?o.index.array:null;for(let r=0,s=t.length;r<s;r++){let a=3*r,c=3*t[r];for(let p=0;p<3;p++)n[a+p]=i?i[c+p]:c+p}}function Ui(o,t,e){let n=o._roots;if(n.length!==1)throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");let i=n[0],r=new Uint16Array(i),s=new Uint32Array(i),a=new Float32Array(i),c=i.byteLength/32,p=2*Math.ceil(Math.sqrt(c/2)),u=new Float32Array(4*p*p),f=Math.ceil(Math.sqrt(c)),l=new Uint32Array(2*f*f);for(let d=0;d<c;d++){let T=d*32/4,v=T*2,A=T;for(let g=0;g<3;g++)u[8*d+0+g]=a[A+0+g],u[8*d+4+g]=a[A+3+g];if(L(v,r)){let g=C(v,r),m=R(T,s),x=-65536|g;l[d*2+0]=x,l[d*2+1]=m}else{let g=s[T+6],m=lt(T,s);l[d*2+0]=m,l[d*2+1]=g}}t.image.data=u,t.image.width=p,t.image.height=p,t.format=At,t.type=yt,t.internalFormat="RGBA32F",t.minFilter=rt,t.magFilter=rt,t.generateMipmaps=!1,t.needsUpdate=!0,t.dispose(),e.image.data=l,e.image.width=f,e.image.height=f,e.format=$t,e.type=mt,e.internalFormat="RG32UI",e.minFilter=rt,e.magFilter=rt,e.generateMipmaps=!1,e.needsUpdate=!0,e.dispose()}var on={};ui(on,{bvh_distance_functions:()=>ii,bvh_ray_functions:()=>nn,bvh_struct_definitions:()=>oi,common_functions:()=>en});var en=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var ii=`

float dot2( vec3 v ) {

	return dot( v, v );

}

// implementation from https://www.shadertoy.com/view/ttfGWl, though method 2 has been removed
// and is now available at this fork: https://www.shadertoy.com/view/WlB3zW
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0 - v;

	}

	// output the barycoord in v0, v1, v2 weight order
	barycoord = vec3( w, u, v );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point, float maxDistance,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = maxDistance * maxDistance;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;
			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`;var nn=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;

			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return found;

}
`;var oi=`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`;var Jr=`
	${en}
	${nn}
`;export{ti as a,be as b,_e as c,ni as d,on as e};
