"use strict";(()=>{var b4=Object.create;var Gg=Object.defineProperty;var v4=Object.getOwnPropertyDescriptor;var w4=Object.getOwnPropertyNames;var C4=Object.getPrototypeOf,S4=Object.prototype.hasOwnProperty;var h=(r,t,e)=>()=>{if(e)throw e[0];try{return r&&(t=r(r=0)),t}catch(o){throw e=[o],o}};var Ur=(r,t)=>()=>{try{return t||r((t={exports:{}}).exports,t),t.exports}catch(e){throw t=0,e}},Yt=(r,t)=>{for(var e in t)Gg(r,e,{get:t[e],enumerable:!0})},N4=(r,t,e,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of w4(t))!S4.call(r,n)&&n!==e&&Gg(r,n,{get:()=>t[n],enumerable:!(o=v4(t,n))||o.enumerable});return r};var Wg=(r,t,e)=>(e=r!=null?b4(C4(r)):{},N4(t||!r||!r.__esModule?Gg(e,"default",{value:r,enumerable:!0}):e,r));function kr(r){throw new Error(`'${r}' not yet implemented or not found in the registry. This kernel may not be supported by the tfjs backend you have chosen`)}var ps,Qo,Ug=h(()=>{ps=class{constructor(t,e){this.backend=t,this.dataMover=e,this.data=new WeakMap,this.dataIdsCount=0}get(t){return this.data.has(t)||this.dataMover.moveData(this.backend,t),this.data.get(t)}set(t,e){this.dataIdsCount++,this.data.set(t,e)}has(t){return this.data.has(t)}delete(t){return this.dataIdsCount--,this.data.delete(t)}numDataIds(){return this.dataIdsCount}},Qo=class{refCount(t){return kr("refCount")}incRef(t){return kr("incRef")}timerAvailable(){return!0}time(t){return kr("time")}read(t){return kr("read")}readSync(t){return kr("readSync")}readToGPU(t,e){return kr("readToGPU")}numDataIds(){return kr("numDataIds")}disposeData(t,e){return kr("disposeData")}write(t,e,o){return kr("write")}move(t,e,o,n,s){return kr("move")}createTensorFromGPUData(t,e,o){return kr("createTensorFromGPUData")}memory(){return kr("memory")}floatPrecision(){return kr("floatPrecision")}epsilon(){return this.floatPrecision()===32?1e-7:1e-4}dispose(){return kr("dispose")}}});function $w(r){let t=r.length,e=0;for(;t>0;)e=Math.random()*t|0,t--,Vp(r,t,e)}function T4(r,t){if(r.length!==t.length)throw new Error(`Array sizes must match to be shuffled together First array length was ${r.length}Second array length was ${t.length}`);let e=r.length,o=0;for(;e>0;)o=Math.random()*e|0,e--,Vp(r,e,o),Vp(t,e,o)}function ii(r,t,e){return Math.max(r,Math.min(t,e))}function I4(r){return r%2===0?r:r+1}function Vp(r,t,e){let o=r[t];r[t]=r[e],r[e]=o}function k4(r){let t=0;for(let e=0;e<r.length;e++)t+=r[e];return t}function E4(r,t){let e=Math.random();return t*e+(1-e)*r}function $4(r,t){let e=0;for(let o=0;o<r.length;o++){let n=Number(r[o])-Number(t[o]);e+=n*n}return e}function $(r,t){if(!r)throw new Error(typeof t=="string"?t:t())}function fe(r,t,e=""){$(Er(r,t),()=>e+` Shapes ${r} and ${t} must match`)}function Hr(r){$(r!=null,()=>"The input to the tensor constructor must be a non-null value.")}function $t(r){if(r.length===0)return 1;let t=r[0];for(let e=1;e<r.length;e++)t*=r[e];return t}function R4(r){return r.length===0}function Hg(r,t){if(r===t)return!0;if(r==null||t==null||r.length!==t.length)return!1;for(let e=0;e<r.length;e++)if(r[e]!==null&&t[e]!==null&&r[e]!==t[e])return!1;return!0}function Er(r,t){if(r===t)return!0;if(r==null||t==null||r.length!==t.length)return!1;for(let e=0;e<r.length;e++)if(r[e]!==t[e])return!1;return!0}function Jo(r){return r%1===0}function A4(r){if(Math.tanh!=null)return Math.tanh(r);if(r===1/0)return 1;if(r===-1/0)return-1;{let t=Math.exp(2*r);return(t-1)/(t+1)}}function _4(r){let t=Math.ceil(Math.sqrt(r));return[t,Math.ceil(r/t)]}function D4(r){let t=new Uint32Array(r);for(let e=0;e<r;++e)t[e]=e;return $w(t),t}function fs(r,t){return t<=r.length?r:r+" ".repeat(t-r.length)}function F4(r,t=n=>0,e,o){return new Promise((n,s)=>{let a=0,i=()=>{if(r()){n();return}a++;let c=t(a);if(e!=null&&a>=e){s();return}o!=null?o(i,c):setTimeout(i,c)};i()})}function O4(r,t){let e=1,o=-1;for(let s=0;s<r.length;++s)if(r[s]>=0)e*=r[s];else if(r[s]===-1){if(o!==-1)throw Error(`Shapes can only have 1 implicit size. Found -1 at dim ${o} and dim ${s}`);o=s}else if(r[s]<0)throw Error(`Shapes can not be < 0. Found ${r[s]} at dim ${s}`);if(o===-1){if(t>0&&t!==e)throw Error(`Size(${t}) must match the product of shape ${r}`);return r}if(e===0)throw Error(`Cannot infer the missing size in [${r}] when there are 0 elements`);if(t%e!==0)throw Error(`The implicit shape can't be a fractional number. Got ${t} / ${e}`);let n=r.slice();return n[o]=t/e,n}function In(r,t){let e=t.length;return r=r==null?t.map((o,n)=>n):[].concat(r),$(r.every(o=>o>=-e&&o<e),()=>`All values in axis param must be in range [-${e}, ${e}) but got axis ${r}`),$(r.every(o=>Jo(o)),()=>`All values in axis param must be integers but got axis ${r}`),r.map(o=>o<0?e+o:o)}function Kg(r,t){let e=[],o=[],n=t!=null&&Array.isArray(t)&&t.length===0,s=t==null||n?null:In(t,r).sort(),a=0;for(let i=0;i<r.length;++i){if(s!=null){if(s[a]===i&&r[i]!==1)throw new Error(`Can't squeeze axis ${i} since its dim '${r[i]}' is not 1`);(s[a]==null||s[a]>i)&&r[i]===1&&(e.push(r[i]),o.push(i)),s[a]<=i&&a++}r[i]!==1&&(e.push(r[i]),o.push(i))}return{newShape:e,keptDims:o}}function qg(r,t){return zp(r,t)}function zp(r,t){let e=null;if(r==null||r==="float32")e=new Float32Array(t);else if(r==="int32")e=new Int32Array(t);else if(r==="bool")e=new Uint8Array(t);else if(r==="string")e=new Array(t);else throw new Error(`Unknown data type ${r}`);return e}function Xg(r,t){for(let e=0;e<r.length;e++){let o=r[e];if(isNaN(o)||!isFinite(o))throw Error(`A tensor of type ${t} being uploaded contains ${o}.`)}}function jg(r){return r==="bool"||r==="complex64"||r==="float32"||r==="int32"||r==="string"}function P4(r,t){return!(t==="complex64"||t==="float32"&&r!=="complex64"||t==="int32"&&r!=="float32"&&r!=="complex64"||t==="bool"&&r==="bool")}function ci(r){if(r==="float32"||r==="int32")return 4;if(r==="complex64")return 8;if(r==="bool")return 1;throw new Error(`Unknown dtype ${r}`)}function Yg(r){if(r==null)return 0;let t=0;return r.forEach(e=>t+=e.length),t}function li(r){return typeof r=="string"||r instanceof String}function Rw(r){return typeof r=="boolean"}function Aw(r){return typeof r=="number"}function kn(r){return Array.isArray(r)?kn(r[0]):r instanceof Float32Array?"float32":r instanceof Int32Array||r instanceof Uint8Array||r instanceof Uint8ClampedArray?"int32":Aw(r)?"float32":li(r)?"string":Rw(r)?"bool":"float32"}function ui(r){return!!(r&&r.constructor&&r.call&&r.apply)}function pi(r,t){for(let e=t;e<r;++e)if(r%e===0)return e;return r}function Ao(r){let t=r.length;if(t<2)return[];let e=new Array(t-1);e[t-2]=r[t-1];for(let o=t-3;o>=0;--o)e[o]=e[o+1]*r[o+1];return e}function _w(r,t,e,o=!1){let n=new Array;if(t.length===1){let s=t[0]*(o?2:1);for(let a=0;a<s;a++)n[a]=e[r+a]}else{let s=t[0],a=t.slice(1),i=a.reduce((c,l)=>c*l)*(o?2:1);for(let c=0;c<s;c++)n[c]=_w(r+c*i,a,e,o)}return n}function ms(r,t,e=!1){if(r.length===0)return t[0];let o=r.reduce((n,s)=>n*s)*(e?2:1);if(o===0)return[];if(o!==t.length)throw new Error(`[${r}] does not match the input size ${t.length}${e?" for a complex tensor":""}.`);return _w(0,r,t,e)}function L4(r,t){if(Array.isArray(r))return r;if(t==="float32")return r instanceof Float32Array?r:new Float32Array(r);if(t==="int32")return r instanceof Int32Array?r:new Int32Array(r);if(t==="bool"||t==="string")return Uint8Array.from(new Int32Array(r));throw new Error(`Unknown dtype ${t}`)}function Jl(r,t){let e=mi(r,t);for(let o=0;o<e.length;o++)e[o]=1;return e}function mi(r,t){if(t==null||t==="float32"||t==="complex64")return new Float32Array(r);if(t==="int32")return new Int32Array(r);if(t==="bool")return new Uint8Array(r);throw new Error(`Unknown data type ${t}`)}function M4(r,t){let e=r.reduce((o,n)=>o*n,1);if(t==null||t==="float32")return ms(r,new Float32Array(e));if(t==="int32")return ms(r,new Int32Array(e));if(t==="bool")return ms(r,new Uint8Array(e));throw new Error(`Unknown data type ${t}`)}function oe(r){r.forEach(t=>{$(Number.isInteger(t)&&t>=0,()=>`Tensor must have a shape comprised of positive integers but got shape [${r}].`)})}function B4(r,t,e){if(t===0)return 0;if(t===1)return r[0];let o=r[r.length-1];for(let n=0;n<r.length-1;++n)o+=e[n]*r[n];return o}function V4(r,t,e){if(t===0)return[];if(t===1)return[r];let o=new Array(t);for(let n=0;n<o.length-1;++n)o[n]=Math.floor(r/e[n]),r-=o[n]*e[n];return o[o.length-1]=r,o}function ds(r){return r&&r.then&&typeof r.then=="function"}var Re=h(()=>{});function G4(r){let t={};return r.replace(/[?&]([^=?&]+)(?:=([^&]*))?/g,(e,...o)=>(W4(t,o[0],o[1]),o.join("="))),t}function W4(r,t,e){r[decodeURIComponent(t)]=decodeURIComponent(e||"")}function U4(r,t){let e=t.toLowerCase();return e==="true"||e==="false"?e==="true":`${+e}`===e?+e:t}function O(){return Zg}function Fw(r){Zg=r}var Dw,tu,Zg,Ke=h(()=>{Re();Dw="tfjsflags",tu=class{constructor(t){this.global=t,this.flags={},this.flagRegistry={},this.urlFlags={},this.getQueryParams=G4,this.populateURLFlags()}setPlatform(t,e){this.platform!=null&&(O().getBool("IS_TEST")||O().getBool("PROD")||console.warn(`Platform ${this.platformName} has already been set. Overwriting the platform with ${t}.`)),this.platformName=t,this.platform=e}registerFlag(t,e,o){if(this.flagRegistry[t]={evaluationFn:e,setHook:o},this.urlFlags[t]!=null){let n=this.urlFlags[t];O().getBool("IS_TEST")||O().getBool("PROD")||console.warn(`Setting feature override from URL ${t}: ${n}.`),this.set(t,n)}}async getAsync(t){return t in this.flags?this.flags[t]:(this.flags[t]=await this.evaluateFlag(t),this.flags[t])}get(t){if(t in this.flags)return this.flags[t];let e=this.evaluateFlag(t);if(ds(e))throw new Error(`Flag ${t} cannot be synchronously evaluated. Please use getAsync() instead.`);return this.flags[t]=e,this.flags[t]}getNumber(t){return this.get(t)}getBool(t){return this.get(t)}getString(t){return this.get(t)}getFlags(){return this.flags}get features(){return this.flags}set(t,e){if(this.flagRegistry[t]==null)throw new Error(`Cannot set flag ${t} as it has not been registered.`);this.flags[t]=e,this.flagRegistry[t].setHook!=null&&this.flagRegistry[t].setHook(e)}evaluateFlag(t){if(this.flagRegistry[t]==null)throw new Error(`Cannot evaluate flag '${t}': no evaluation function found.`);return this.flagRegistry[t].evaluationFn()}setFlags(t){this.flags=Object.assign({},t)}reset(){this.flags={},this.urlFlags={},this.populateURLFlags()}populateURLFlags(){if(typeof this.global=="undefined"||typeof this.global.location=="undefined"||typeof this.global.location.search=="undefined")return;let t=this.getQueryParams(this.global.location.search);Dw in t&&t[Dw].split(",").forEach(o=>{let[n,s]=o.split(":");this.urlFlags[n]=U4(n,s)})}};Zg=null});function Jg(){if(Qg==null){let r;if(typeof window!="undefined")r=window;else if(typeof global!="undefined")r=global;else if(typeof process!="undefined")r=process;else if(typeof self!="undefined")r=self;else throw new Error("Could not find a global object");Qg=r}return Qg}function H4(){let r=Jg();return r._tfGlobals==null&&(r._tfGlobals=new Map),r._tfGlobals}function eu(r,t){let e=H4();if(e.has(r))return e.get(r);{let o=t();return e.set(r,o),e.get(r)}}var Qg,Gp=h(()=>{});var hs,gs,fi,di,hi,xs,ys,bs,vs,ws,gi,Wp,xi,Up,yi,bi,vi,Cs,wi,En,Ss,Ns,Ci,Si,Ni,Ti,Ii,ki,Ei,Hp,$i,Ts,Ri,Ai,_i,Di,Fi,Oi,Pi,Li,Mi,Bi,tx,ex,ru,Is,Vi,Kp,ks,zi,Es,Gi,Wi,$s,Rs,Ui,Hi,Ki,As,_s,$n,qi,Xi,Ds,Fs,Os,ji,Ps,Ls,Yi,Ms,Bs,Vs,zs,qp,Gs,Zi,Xp,Qi,jp,Ji,tc,Ws,ec,rc,Us,Hs,oc,nc,sc,ac,ic,cc,lc,uc,pc,mc,fc,dc,hc,gc,Ks,qs,xc,yc,Yp,bc,Zp,Xs,vc,js,Ys,wc,Cc,Sc,Nc,Zs,Tc,Qs,Js,ta,ea,ra,Ic,kc,Ec,$c,Rc,Ac,_c,Dc,oa,Qp,na,Fc,Oc,Pc,Lc,sa,Rn,Mc,Bc,An,Vc,zc,Gc,Wc,aa,ou,Uc,ia,ca,la,H=h(()=>{hs="Acos",gs="Acosh",fi="AddN",di="ArgMax",hi="ArgMin",xs="Asin",ys="Asinh",bs="Atan",vs="Atanh",ws="Atan2",gi="AvgPool",Wp="AvgPoolGrad",xi="AvgPool3D",Up="AvgPool3DGrad",yi="BatchMatMul",bi="BatchToSpaceND",vi="Bincount",Cs="BitwiseAnd",wi="BroadcastArgs",En="Cast",Ss="Ceil",Ns="ClipByValue",Ci="Complex",Si="ComplexAbs",Ni="Concat",Ti="Conv2D",Ii="Conv2DBackpropFilter",ki="Conv2DBackpropInput",Ei="Conv3D",Hp="Conv3DBackpropFilterV2",$i="Conv3DBackpropInputV2",Ts="Cosh",Ri="Cumprod",Ai="Cumsum",_i="CropAndResize",Di="DenseBincount",Fi="DepthToSpace",Oi="DepthwiseConv2dNative",Pi="DepthwiseConv2dNativeBackpropFilter",Li="DepthwiseConv2dNativeBackpropInput",Mi="Diag",Bi="Dilation2D",tx="Dilation2DBackpropInput",ex="Dilation2DBackpropFilter",ru="Draw",Is="RealDiv",Vi="Einsum",Kp="EluGrad",ks="Equal",zi="ExpandDims",Es="Expm1",Gi="Fill",Wi="FlipLeftRight",$s="Floor",Rs="FloorDiv",Ui="FusedBatchNorm",Hi="GatherV2",Ki="GatherNd",As="Greater",_s="GreaterEqual",$n="Identity",qi="IFFT",Xi="Imag",Ds="IsFinite",Fs="IsInf",Os="IsNan",ji="LeakyRelu",Ps="Less",Ls="LessEqual",Yi="LinSpace",Ms="Log1p",Bs="LogicalAnd",Vs="LogicalNot",zs="LogicalOr",qp="LRNGrad",Gs="Maximum",Zi="MaxPool",Xp="MaxPoolGrad",Qi="MaxPool3D",jp="MaxPool3DGrad",Ji="MaxPoolWithArgmax",tc="Mean",Ws="Minimum",ec="MirrorPad",rc="Multinomial",Us="Multiply",Hs="NotEqual",oc="NonMaxSuppressionV3",nc="NonMaxSuppressionV4",sc="NonMaxSuppressionV5",ac="OnesLike",ic="OneHot",cc="Pack",lc="PadV2",uc="Prelu",pc="Prod",mc="RaggedGather",fc="RaggedRange",dc="RaggedTensorToTensor",hc="Range",gc="Real",Ks="Reciprocal",qs="Relu",xc="Reshape",yc="ResizeNearestNeighbor",Yp="ResizeNearestNeighborGrad",bc="ResizeBilinear",Zp="ResizeBilinearGrad",Xs="Relu6",vc="Reverse",js="Round",Ys="Rsqrt",wc="ScatterNd",Cc="TensorScatterUpdate",Sc="SearchSorted",Nc="Select",Zs="Selu",Tc="Slice",Qs="Sinh",Js="Sign",ta="Sigmoid",ea="Softplus",ra="Sqrt",Ic="SpaceToBatchND",kc="SplitV",Ec="Softmax",$c="SparseFillEmptyRows",Rc="SparseReshape",Ac="SparseSegmentMean",_c="SparseSegmentSum",Dc="SparseToDense",oa="SquaredDifference",Qp="Square",na="StaticRegexReplace",Fc="StridedSlice",Oc="StringNGrams",Pc="StringSplit",Lc="StringToHashBucketFast",sa="Tanh",Rn="Tile",Mc="TopK",Bc="Transform",An="Transpose",Vc="Unique",zc="Unpack",Gc="UnsortedSegmentSum",Wc="ZerosLike",aa="Step",ou="FromPixels",Uc="RotateWithOffset",ia="_FusedMatMul",ca="FusedConv2D",la="FusedDepthwiseConv2D"});function tn(...r){O().getBool("IS_TEST")||O().getBool("PROD")||console.warn(...r)}function K4(...r){O().getBool("IS_TEST")||O().getBool("PROD")||console.log(...r)}var Jp=h(()=>{Ke();});function Hc(r,t){let e=Pw(r,t);return tm.get(e)}function rx(r){return q4.get(r)}function ox(r){let t=tm.entries(),e=[];for(;;){let{done:o,value:n}=t.next();if(o)break;let[s,a]=n,[i]=s.split("_");i===r&&e.push(a)}return e}function em(r){let{kernelName:t,backendName:e}=r,o=Pw(t,e);tm.has(o)&&tn(`The kernel '${t}' for backend '${e}' is already registered`),tm.set(o,r)}function Pw(r,t){return`${t}_${r}`}var tm,q4,rm=h(()=>{Gp();Jp();tm=eu("kernelRegistry",()=>new Map),q4=eu("gradRegistry",()=>new Map)});function om(r){return r instanceof Float32Array||r instanceof Int32Array||r instanceof Uint8Array||r instanceof Uint8ClampedArray}var nx=h(()=>{});var qw=Ur((zrt,Kw)=>{Kw.exports=ue;var Jr=null;try{Jr=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function ue(r,t,e){this.low=r|0,this.high=t|0,this.unsigned=!!e}ue.prototype.__isLong__;Object.defineProperty(ue.prototype,"__isLong__",{value:!0});function Rr(r){return(r&&r.__isLong__)===!0}ue.isLong=Rr;var Lw={},Mw={};function pa(r,t){var e,o,n;return t?(r>>>=0,(n=0<=r&&r<256)&&(o=Mw[r],o)?o:(e=pe(r,(r|0)<0?-1:0,!0),n&&(Mw[r]=e),e)):(r|=0,(n=-128<=r&&r<128)&&(o=Lw[r],o)?o:(e=pe(r,r<0?-1:0,!1),n&&(Lw[r]=e),e))}ue.fromInt=pa;function to(r,t){if(isNaN(r))return t?ua:eo;if(t){if(r<0)return ua;if(r>=Gw)return Hw}else{if(r<=-Vw)return $r;if(r+1>=Vw)return Uw}return r<0?to(-r,t).neg():pe(r%qc|0,r/qc|0,t)}ue.fromNumber=to;function pe(r,t,e){return new ue(r,t,e)}ue.fromBits=pe;var nm=Math.pow;function ax(r,t,e){if(r.length===0)throw Error("empty string");if(r==="NaN"||r==="Infinity"||r==="+Infinity"||r==="-Infinity")return eo;if(typeof t=="number"?(e=t,t=!1):t=!!t,e=e||10,e<2||36<e)throw RangeError("radix");var o;if((o=r.indexOf("-"))>0)throw Error("interior hyphen");if(o===0)return ax(r.substring(1),t,e).neg();for(var n=to(nm(e,8)),s=eo,a=0;a<r.length;a+=8){var i=Math.min(8,r.length-a),c=parseInt(r.substring(a,a+i),e);if(i<8){var l=to(nm(e,i));s=s.mul(l).add(to(c))}else s=s.mul(n),s=s.add(to(c))}return s.unsigned=t,s}ue.fromString=ax;function ho(r,t){return typeof r=="number"?to(r,t):typeof r=="string"?ax(r,t):pe(r.low,r.high,typeof t=="boolean"?t:r.unsigned)}ue.fromValue=ho;var Bw=65536,X4=1<<24,qc=Bw*Bw,Gw=qc*qc,Vw=Gw/2,zw=pa(X4),eo=pa(0);ue.ZERO=eo;var ua=pa(0,!0);ue.UZERO=ua;var Kc=pa(1);ue.ONE=Kc;var Ww=pa(1,!0);ue.UONE=Ww;var sx=pa(-1);ue.NEG_ONE=sx;var Uw=pe(-1,2147483647,!1);ue.MAX_VALUE=Uw;var Hw=pe(-1,-1,!0);ue.MAX_UNSIGNED_VALUE=Hw;var $r=pe(0,-2147483648,!1);ue.MIN_VALUE=$r;var it=ue.prototype;it.toInt=function(){return this.unsigned?this.low>>>0:this.low};it.toNumber=function(){return this.unsigned?(this.high>>>0)*qc+(this.low>>>0):this.high*qc+(this.low>>>0)};it.toString=function(t){if(t=t||10,t<2||36<t)throw RangeError("radix");if(this.isZero())return"0";if(this.isNegative())if(this.eq($r)){var e=to(t),o=this.div(e),n=o.mul(e).sub(this);return o.toString(t)+n.toInt().toString(t)}else return"-"+this.neg().toString(t);for(var s=to(nm(t,6),this.unsigned),a=this,i="";;){var c=a.div(s),l=a.sub(c.mul(s)).toInt()>>>0,u=l.toString(t);if(a=c,a.isZero())return u+i;for(;u.length<6;)u="0"+u;i=""+u+i}};it.getHighBits=function(){return this.high};it.getHighBitsUnsigned=function(){return this.high>>>0};it.getLowBits=function(){return this.low};it.getLowBitsUnsigned=function(){return this.low>>>0};it.getNumBitsAbs=function(){if(this.isNegative())return this.eq($r)?64:this.neg().getNumBitsAbs();for(var t=this.high!=0?this.high:this.low,e=31;e>0&&(t&1<<e)==0;e--);return this.high!=0?e+33:e+1};it.isZero=function(){return this.high===0&&this.low===0};it.eqz=it.isZero;it.isNegative=function(){return!this.unsigned&&this.high<0};it.isPositive=function(){return this.unsigned||this.high>=0};it.isOdd=function(){return(this.low&1)===1};it.isEven=function(){return(this.low&1)===0};it.equals=function(t){return Rr(t)||(t=ho(t)),this.unsigned!==t.unsigned&&this.high>>>31===1&&t.high>>>31===1?!1:this.high===t.high&&this.low===t.low};it.eq=it.equals;it.notEquals=function(t){return!this.eq(t)};it.neq=it.notEquals;it.ne=it.notEquals;it.lessThan=function(t){return this.comp(t)<0};it.lt=it.lessThan;it.lessThanOrEqual=function(t){return this.comp(t)<=0};it.lte=it.lessThanOrEqual;it.le=it.lessThanOrEqual;it.greaterThan=function(t){return this.comp(t)>0};it.gt=it.greaterThan;it.greaterThanOrEqual=function(t){return this.comp(t)>=0};it.gte=it.greaterThanOrEqual;it.ge=it.greaterThanOrEqual;it.compare=function(t){if(Rr(t)||(t=ho(t)),this.eq(t))return 0;var e=this.isNegative(),o=t.isNegative();return e&&!o?-1:!e&&o?1:this.unsigned?t.high>>>0>this.high>>>0||t.high===this.high&&t.low>>>0>this.low>>>0?-1:1:this.sub(t).isNegative()?-1:1};it.comp=it.compare;it.negate=function(){return!this.unsigned&&this.eq($r)?$r:this.not().add(Kc)};it.neg=it.negate;it.add=function(t){Rr(t)||(t=ho(t));var e=this.high>>>16,o=this.high&65535,n=this.low>>>16,s=this.low&65535,a=t.high>>>16,i=t.high&65535,c=t.low>>>16,l=t.low&65535,u=0,p=0,m=0,f=0;return f+=s+l,m+=f>>>16,f&=65535,m+=n+c,p+=m>>>16,m&=65535,p+=o+i,u+=p>>>16,p&=65535,u+=e+a,u&=65535,pe(m<<16|f,u<<16|p,this.unsigned)};it.subtract=function(t){return Rr(t)||(t=ho(t)),this.add(t.neg())};it.sub=it.subtract;it.multiply=function(t){if(this.isZero())return eo;if(Rr(t)||(t=ho(t)),Jr){var e=Jr.mul(this.low,this.high,t.low,t.high);return pe(e,Jr.get_high(),this.unsigned)}if(t.isZero())return eo;if(this.eq($r))return t.isOdd()?$r:eo;if(t.eq($r))return this.isOdd()?$r:eo;if(this.isNegative())return t.isNegative()?this.neg().mul(t.neg()):this.neg().mul(t).neg();if(t.isNegative())return this.mul(t.neg()).neg();if(this.lt(zw)&&t.lt(zw))return to(this.toNumber()*t.toNumber(),this.unsigned);var o=this.high>>>16,n=this.high&65535,s=this.low>>>16,a=this.low&65535,i=t.high>>>16,c=t.high&65535,l=t.low>>>16,u=t.low&65535,p=0,m=0,f=0,d=0;return d+=a*u,f+=d>>>16,d&=65535,f+=s*u,m+=f>>>16,f&=65535,f+=a*l,m+=f>>>16,f&=65535,m+=n*u,p+=m>>>16,m&=65535,m+=s*l,p+=m>>>16,m&=65535,m+=a*c,p+=m>>>16,m&=65535,p+=o*u+n*l+s*c+a*i,p&=65535,pe(f<<16|d,p<<16|m,this.unsigned)};it.mul=it.multiply;it.divide=function(t){if(Rr(t)||(t=ho(t)),t.isZero())throw Error("division by zero");if(Jr){if(!this.unsigned&&this.high===-2147483648&&t.low===-1&&t.high===-1)return this;var e=(this.unsigned?Jr.div_u:Jr.div_s)(this.low,this.high,t.low,t.high);return pe(e,Jr.get_high(),this.unsigned)}if(this.isZero())return this.unsigned?ua:eo;var o,n,s;if(this.unsigned){if(t.unsigned||(t=t.toUnsigned()),t.gt(this))return ua;if(t.gt(this.shru(1)))return Ww;s=ua}else{if(this.eq($r)){if(t.eq(Kc)||t.eq(sx))return $r;if(t.eq($r))return Kc;var a=this.shr(1);return o=a.div(t).shl(1),o.eq(eo)?t.isNegative()?Kc:sx:(n=this.sub(t.mul(o)),s=o.add(n.div(t)),s)}else if(t.eq($r))return this.unsigned?ua:eo;if(this.isNegative())return t.isNegative()?this.neg().div(t.neg()):this.neg().div(t).neg();if(t.isNegative())return this.div(t.neg()).neg();s=eo}for(n=this;n.gte(t);){o=Math.max(1,Math.floor(n.toNumber()/t.toNumber()));for(var i=Math.ceil(Math.log(o)/Math.LN2),c=i<=48?1:nm(2,i-48),l=to(o),u=l.mul(t);u.isNegative()||u.gt(n);)o-=c,l=to(o,this.unsigned),u=l.mul(t);l.isZero()&&(l=Kc),s=s.add(l),n=n.sub(u)}return s};it.div=it.divide;it.modulo=function(t){if(Rr(t)||(t=ho(t)),Jr){var e=(this.unsigned?Jr.rem_u:Jr.rem_s)(this.low,this.high,t.low,t.high);return pe(e,Jr.get_high(),this.unsigned)}return this.sub(this.div(t).mul(t))};it.mod=it.modulo;it.rem=it.modulo;it.not=function(){return pe(~this.low,~this.high,this.unsigned)};it.and=function(t){return Rr(t)||(t=ho(t)),pe(this.low&t.low,this.high&t.high,this.unsigned)};it.or=function(t){return Rr(t)||(t=ho(t)),pe(this.low|t.low,this.high|t.high,this.unsigned)};it.xor=function(t){return Rr(t)||(t=ho(t)),pe(this.low^t.low,this.high^t.high,this.unsigned)};it.shiftLeft=function(t){return Rr(t)&&(t=t.toInt()),(t&=63)===0?this:t<32?pe(this.low<<t,this.high<<t|this.low>>>32-t,this.unsigned):pe(0,this.low<<t-32,this.unsigned)};it.shl=it.shiftLeft;it.shiftRight=function(t){return Rr(t)&&(t=t.toInt()),(t&=63)===0?this:t<32?pe(this.low>>>t|this.high<<32-t,this.high>>t,this.unsigned):pe(this.high>>t-32,this.high>=0?0:-1,this.unsigned)};it.shr=it.shiftRight;it.shiftRightUnsigned=function(t){if(Rr(t)&&(t=t.toInt()),t&=63,t===0)return this;var e=this.high;if(t<32){var o=this.low;return pe(o>>>t|e<<32-t,e>>>t,this.unsigned)}else return t===32?pe(e,0,this.unsigned):pe(e>>>t-32,0,this.unsigned)};it.shru=it.shiftRightUnsigned;it.shr_u=it.shiftRightUnsigned;it.toSigned=function(){return this.unsigned?pe(this.low,this.high,!1):this};it.toUnsigned=function(){return this.unsigned?this:pe(this.low,this.high,!0)};it.toBytes=function(t){return t?this.toBytesLE():this.toBytesBE()};it.toBytesLE=function(){var t=this.high,e=this.low;return[e&255,e>>>8&255,e>>>16&255,e>>>24,t&255,t>>>8&255,t>>>16&255,t>>>24]};it.toBytesBE=function(){var t=this.high,e=this.low;return[t>>>24,t>>>16&255,t>>>8&255,t&255,e>>>24,e>>>16&255,e>>>8&255,e&255]};ue.fromBytes=function(t,e,o){return o?ue.fromBytesLE(t,e):ue.fromBytesBE(t,e)};ue.fromBytesLE=function(t,e){return new ue(t[0]|t[1]<<8|t[2]<<16|t[3]<<24,t[4]|t[5]<<8|t[6]<<16|t[7]<<24,e)};ue.fromBytesBE=function(t,e){return new ue(t[4]<<24|t[5]<<16|t[6]<<8|t[7],t[0]<<24|t[1]<<16|t[2]<<8|t[3],e)}});function nu(r){return fa.fromString(r,!0,16)}function ix(r){return r.xor(r.shru(47))}function Yw(r,t,e){let o=r.slice(t,t+e);return fa.fromBytes(Array.from(o),!0,!0)}function ne(r,t){return Yw(r,t,8)}function Xw(r,t){return Yw(r,t,4)}function Me(r,t){return t===0?r:r.shru(t).or(r.shl(64-t))}function _n(r,t,e=nu("9ddfea08eb382d69")){let o=r.xor(t).mul(e);o=o.xor(o.shru(47));let n=t.xor(o).mul(e);return n=n.xor(n.shru(47)),n=n.mul(e),n}function j4(r,t,e,o,n,s){n=n.add(r),s=Me(s.add(n).add(o),21);let a=n;return n=n.add(t),n=n.add(e),s=s.add(Me(n,44)),[n.add(o),s.add(a)]}function sm(r,t,e,o){return j4(ne(r,t),ne(r,t+8),ne(r,t+16),ne(r,t+24),e,o)}function Y4(r,t=r.length){if(t>=8){let e=sr.add(t*2),o=ne(r,0).add(sr),n=ne(r,t-8),s=Me(n,37).mul(e).add(o),a=Me(o,25).add(n).mul(e);return _n(s,a,e)}if(t>=4){let e=sr.add(t*2),o=Xw(r,0);return _n(o.shl(3).add(t),Xw(r,t-4),e)}if(t>0){let e=r[0],o=r[t>>1],n=r[t-1],s=e+(o<<8),a=t+(n<<2);return ix(sr.mul(s).xor(jw.mul(a))).mul(sr)}return sr}function Z4(r,t=r.length){let e=sr.add(t*2),o=ne(r,0).mul(ma),n=ne(r,8),s=ne(r,t-8).mul(e),a=ne(r,t-16).mul(sr);return _n(Me(o.add(n),43).add(Me(s,30)).add(a),o.add(Me(n.add(sr),18)).add(s),e)}function Q4(r,t=r.length){let e=sr.add(t*2),o=ne(r,0).mul(sr),n=ne(r,8),s=ne(r,t-8).mul(e),a=ne(r,t-16).mul(sr),i=Me(o.add(n),43).add(Me(s,30)).add(a),c=_n(i,o.add(Me(n.add(sr),18)).add(s),e),l=ne(r,16).mul(e),u=ne(r,24),p=i.add(ne(r,t-32)).mul(e),m=c.add(ne(r,t-24)).mul(e);return _n(Me(l.add(u),43).add(Me(p,30)).add(m),l.add(Me(u.add(o),18)).add(p),e)}function J4(r,t=r.length){let e=fa.fromNumber(81,!0);if(t<=32)return t<=16?Y4(r,t):Z4(r,t);if(t<=64)return Q4(r,t);let o=e,n=e.mul(ma).add(113),s=ix(n.mul(sr).add(113)).mul(sr),a=[fa.UZERO,fa.UZERO],i=[fa.UZERO,fa.UZERO];o=o.mul(sr).add(ne(r,0));let c=0,l=(t-1>>6)*64,u=l+(t-1&63)-63;do o=Me(o.add(n).add(a[0]).add(ne(r,c+8)),37).mul(ma),n=Me(n.add(a[1]).add(ne(r,c+48)),42).mul(ma),o=o.xor(i[1]),n=n.add(a[0]).add(ne(r,c+40)),s=Me(s.add(i[0]),33).mul(ma),a=sm(r,c,a[1].mul(ma),o.add(i[0])),i=sm(r,c+32,s.add(i[1]),n.add(ne(r,c+16))),[s,o]=[o,s],c+=64;while(c!==l);let p=ma.add(s.and(255).shl(1));return c=u,i[0]=i[0].add(t-1&63),a[0]=a[0].add(i[0]),i[0]=i[0].add(a[0]),o=Me(o.add(n).add(a[0]).add(ne(r,c+8)),37).mul(p),n=Me(n.add(a[1]).add(ne(r,c+48)),42).mul(p),o=o.xor(i[1].mul(9)),n=n.add(a[0].mul(9).add(ne(r,c+40))),s=Me(s.add(i[0]),33).mul(p),a=sm(r,c,a[1].mul(p),o.add(i[0])),i=sm(r,c+32,s.add(i[1]),n.add(ne(r,c+16))),[s,o]=[o,s],_n(_n(a[0],i[0],p).add(ix(n).mul(jw)).add(s),_n(a[1],i[1],p).add(o),p)}var cx,fa,jw,ma,sr,Zw=h(()=>{cx=Wg(qw());fa=cx.default||cx;jw=nu("c3a5c85c97cb3127"),ma=nu("b492b66fbe98f273"),sr=nu("9ae16a3b2f90404f")});var b={};Yt(b,{arraysEqual:()=>Er,arraysEqualWithNull:()=>Hg,assert:()=>$,assertNonNegativeIntegerDimensions:()=>oe,assertNonNull:()=>Hr,assertShapesMatch:()=>fe,bytesFromStringArray:()=>Yg,bytesPerElement:()=>ci,checkConversionForErrors:()=>Xg,clamp:()=>ii,computeStrides:()=>Ao,convertBackendValuesAndArrayBuffer:()=>L4,createScalarValue:()=>tU,createShuffledIndices:()=>D4,decodeString:()=>Yc,distSquared:()=>$4,encodeString:()=>jc,fetch:()=>rU,fingerPrint64:()=>J4,flatten:()=>Dn,getArrayFromDType:()=>zp,getTypedArrayFromDType:()=>qg,hasEncodingLoss:()=>P4,hexToLong:()=>nu,indexToLoc:()=>V4,inferDtype:()=>kn,inferFromImplicitShape:()=>O4,isBoolean:()=>Rw,isFunction:()=>ui,isInt:()=>Jo,isNumber:()=>Aw,isPromise:()=>ds,isScalarShape:()=>R4,isString:()=>li,isTypedArray:()=>er,isValidDtype:()=>jg,locToIndex:()=>B4,makeOnesTypedArray:()=>Jl,makeZerosNestedTypedArray:()=>M4,makeZerosTypedArray:()=>mi,nearestDivisor:()=>pi,nearestLargerEven:()=>I4,now:()=>da,parseAxisParam:()=>In,randUniform:()=>E4,repeatedTry:()=>F4,rightPad:()=>fs,shuffle:()=>$w,shuffleCombo:()=>T4,sizeFromShape:()=>$t,sizeToSquarishShape:()=>_4,squeezeShape:()=>Kg,sum:()=>k4,swap:()=>Vp,tanh:()=>A4,toNestedArray:()=>ms,toTypedArray:()=>Xc});function tU(r,t){return t==="string"?jc(r):Xc([r],t)}function eU(r,t){return r instanceof Float32Array&&t==="float32"||r instanceof Int32Array&&t==="int32"||r instanceof Uint8Array&&t==="bool"}function Xc(r,t){if(t==="string")throw new Error("Cannot convert a string[] to a TypedArray");if(Array.isArray(r)&&(r=Dn(r)),O().getBool("DEBUG")&&Xg(r,t),eU(r,t))return r;if(t==null||t==="float32"||t==="complex64")return new Float32Array(r);if(t==="int32")return new Int32Array(r);if(t==="bool"){let e=new Uint8Array(r.length);for(let o=0;o<e.length;++o)Math.round(r[o])!==0&&(e[o]=1);return e}else throw new Error(`Unknown data type ${t}`)}function da(){return O().platform.now()}function rU(r,t){return O().platform.fetch(r,t)}function jc(r,t="utf-8"){return t=t||"utf-8",O().platform.encode(r,t)}function Yc(r,t="utf-8"){return t=t||"utf-8",O().platform.decode(r,t)}function er(r){return O().platform.isTypedArray!=null?O().platform.isTypedArray(r):om(r)}function Dn(r,t=[],e=!1){if(t==null&&(t=[]),typeof r=="boolean"||typeof r=="number"||typeof r=="string"||ds(r)||r==null||er(r)&&e)t.push(r);else if(Array.isArray(r)||er(r))for(let o=0;o<r.length;++o)Dn(r[o],t,e);else{let o=-1;for(let n of Object.keys(r))/^([1-9]+[0-9]*|0)$/.test(n)&&(o=Math.max(o,Number(n)));for(let n=0;n<=o;n++)Dn(r[n],t,e)}return t}var X=h(()=>{Ke();nx();Re();Re();Zw();});function oU(r,t,e){if(t!=="float32")return!1;for(let o=0;o<r.length;o++){let n=r[o];if(isNaN(n)||!isFinite(n))return console.warn(`Found ${n} in the result of '${e}'`),!0}return!1}var am,lx,Qw=h(()=>{Ke();X();am=class{constructor(t,e){this.backendTimer=t,this.logger=e,e==null&&(this.logger=new lx)}profileKernel(t,e,o){let n,s=()=>{n=o()},a,i=da();if(this.backendTimer.timerAvailable())a=this.backendTimer.time(s);else{s();for(let l of n)l.dataSync();a=Promise.resolve({kernelMs:da()-i})}if(O().getBool("CHECK_COMPUTATION_FOR_ERRORS"))for(let l=0;l<n.length;l++){let u=n[l];u.data().then(p=>{oU(p,u.dtype,t)})}return{kernelName:t,outputs:n,inputs:e,timeMs:a.then(l=>l.kernelMs),extraInfo:a.then(l=>l.getExtraProfileInfo!=null?l.getExtraProfileInfo():"")}}logKernelProfile(t){let{kernelName:e,outputs:o,timeMs:n,inputs:s,extraInfo:a}=t;o.forEach(i=>{Promise.all([i.data(),n,a]).then(c=>{this.logger.logKernelProfile(e,i,c[0],c[1],s,c[2])})})}};lx=class{logKernelProfile(t,e,o,n,s,a){let i=typeof n=="number"?fs(`${n}ms`,9):n.error,c=fs(t,25),l=e.rank,u=e.size,p=fs(e.shape.toString(),14),m="";for(let f in s){let d=s[f];if(d!=null){let x=d.shape||e.shape,g=x.length;m+=`${f}: ${g}D ${g>0?x:""} `}}console.log(`%c${c}	%c${i}	%c${l}D ${p}	%c${u}	%c${m}	%c${a}`,"font-weight:bold","color:red","color:blue","color: orange","color: green","color: steelblue")}}});function Jw(r,t,e){let o={},n={};for(let c=0;c<t.length;c++)o[t[c].id]=!0;for(let c=0;c<r.length;c++){let l=r[c],u=l.inputs;for(let p in u){let m=u[p],f=!1;for(let d=0;d<t.length;d++)if(o[m.id]){l.outputs.forEach(x=>o[x.id]=!0),f=!0,n[l.id]=!0;break}if(f)break}}let s={};s[e.id]=!0;let a={};for(let c=r.length-1;c>=0;c--){let l=r[c],u=l.inputs;for(let p=0;p<l.outputs.length;p++)if(s[l.outputs[p].id]){for(let m in u)s[u[m].id]=!0,a[l.id]=!0;break}}let i=[];for(let c=0;c<r.length;c++){let l=r[c];if(n[l.id]&&a[l.id]){let u={};for(let m in l.inputs){let f=l.inputs[m];o[f.id]&&(u[m]=f)}let p=Object.assign({},l);p.inputs=u,p.outputs=l.outputs,i.push(p)}}return i}function tC(r,t,e,o){for(let n=t.length-1;n>=0;n--){let s=t[n],a=[];if(s.outputs.forEach(c=>{let l=r[c.id];l!=null?a.push(l):a.push(null)}),s.gradient==null)throw new Error(`Cannot compute gradient: gradient function not found for ${s.kernelName}.`);let i=s.gradient(a);for(let c in s.inputs){if(!(c in i))throw new Error(`Cannot backprop through input ${c}. Available gradients found: ${Object.keys(i)}.`);let l=e(()=>i[c]());if(l.dtype!=="float32")throw new Error(`Error in gradient for op ${s.kernelName}. The gradient of input ${c} must have 'float32' dtype, but has '${l.dtype}'`);let u=s.inputs[c];if(!Er(l.shape,u.shape))throw new Error(`Error in gradient for op ${s.kernelName}. The gradient of input '${c}' has shape '${l.shape}', which does not match the shape of the input '${u.shape}'`);if(r[u.id]==null)r[u.id]=l;else{let p=r[u.id];r[u.id]=o(p,l),p.dispose()}}}}var eC=h(()=>{X();});function oC(r,t,e,o){let n=Ao(t),s=nU(r,t,e,n),a=t.length,i=im(r,t,e,n,s),c=["Tensor"];return o&&(c.push(`  dtype: ${e}`),c.push(`  rank: ${a}`),c.push(`  shape: [${t}]`),c.push("  values:")),c.push(i.map(l=>"    "+l).join(`
`)),c.join(`
`)}function nU(r,t,e,o){let n=$t(t),s=o[o.length-1],a=new Array(s).fill(0),i=t.length,c=e==="complex64"?iu(r):r;if(i>1)for(let l=0;l<n/s;l++){let u=l*s;for(let p=0;p<s;p++)a[p]=Math.max(a[p],au(c[u+p],0,e).length)}return a}function au(r,t,e){let o;return Array.isArray(r)?o=`${parseFloat(r[0].toFixed(ux))} + ${parseFloat(r[1].toFixed(ux))}j`:li(r)?o=`'${r}'`:e==="bool"?o=nC(r):o=parseFloat(r.toFixed(ux)).toString(),fs(o,t)}function nC(r){return r===0?"false":"true"}function im(r,t,e,o,n,s=!0){let a=e==="complex64"?2:1,i=t[0],c=t.length;if(c===0){if(e==="complex64"){let x=iu(r);return[au(x[0],0,e)]}return e==="bool"?[nC(r[0])]:[r[0].toString()]}if(c===1){if(i>rC){let g=su*a,y=Array.from(r.slice(0,g)),v=Array.from(r.slice((i-su)*a,i*a));return e==="complex64"&&(y=iu(y),v=iu(v)),["["+y.map((N,S)=>au(N,n[S],e)).join(", ")+", ..., "+v.map((N,S)=>au(N,n[i-su+S],e)).join(", ")+"]"]}return["["+(e==="complex64"?iu(r):Array.from(r)).map((g,y)=>au(g,n[y],e)).join(", ")+"]"]}let l=t.slice(1),u=o.slice(1),p=o[0]*a,m=[];if(i>rC){for(let x=0;x<su;x++){let g=x*p,y=g+p;m.push(...im(r.slice(g,y),l,e,u,n,!1))}m.push("...");for(let x=i-su;x<i;x++){let g=x*p,y=g+p;m.push(...im(r.slice(g,y),l,e,u,n,x===i-1))}}else for(let x=0;x<i;x++){let g=x*p,y=g+p;m.push(...im(r.slice(g,y),l,e,u,n,x===i-1))}let f=c===2?",":"";m[0]="["+(i>0?m[0]+f:"");for(let x=1;x<m.length-1;x++)m[x]=" "+m[x]+f;let d=`,
`;for(let x=2;x<c;x++)d+=`
`;return m[m.length-1]=" "+m[m.length-1]+"]"+(s?"":d),m}function iu(r){let t=[];for(let e=0;e<r.length;e+=2)t.push([r[e],r[e+1]]);return t}var rC,su,ux,sC=h(()=>{X();rC=20,su=3,ux=7});function aC(r){go=r}function iC(r){Zc=r}function cC(r){sU=r}function px(){return eu("Tensor",()=>ee)}var Bt,go,Zc,sU,ee,en,Kr=h(()=>{Gp();sC();X();X();Bt=class{constructor(t,e,o){if(this.dtype=e,this.shape=t.slice(),this.size=$t(t),o!=null){let n=o.length;$(n===this.size,()=>`Length of values '${n}' does not match the size inferred by the shape '${this.size}'.`)}if(e==="complex64")throw new Error("complex64 dtype TensorBuffers are not supported. Please create a TensorBuffer for the real and imaginary parts separately and call tf.complex(real, imag).");this.values=o||zp(e,this.size),this.strides=Ao(t)}set(t,...e){e.length===0&&(e=[0]),$(e.length===this.rank,()=>`The number of provided coordinates (${e.length}) must match the rank (${this.rank})`);let o=this.locToIndex(e);this.values[o]=t}get(...t){t.length===0&&(t=[0]);let e=0;for(let n of t){if(n<0||n>=this.shape[e]){let s=`Requested out of range element at ${t}.   Buffer shape=${this.shape}`;throw new Error(s)}e++}let o=t[t.length-1];for(let n=0;n<t.length-1;++n)o+=this.strides[n]*t[n];return this.values[o]}locToIndex(t){if(this.rank===0)return 0;if(this.rank===1)return t[0];let e=t[t.length-1];for(let o=0;o<t.length-1;++o)e+=this.strides[o]*t[o];return e}indexToLoc(t){if(this.rank===0)return[];if(this.rank===1)return[t];let e=new Array(this.shape.length);for(let o=0;o<e.length-1;++o)e[o]=Math.floor(t/this.strides[o]),t-=e[o]*this.strides[o];return e[e.length-1]=t,e}get rank(){return this.shape.length}toTensor(){return go().makeTensor(this.values,this.shape,this.dtype)}},go=null,Zc=null,sU=null;ee=class{constructor(t,e,o,n){this.kept=!1,this.isDisposedInternal=!1,this.shape=t.slice(),this.dtype=e||"float32",this.size=$t(t),this.strides=Ao(t),this.dataId=o,this.id=n,this.rankType=this.rank<5?this.rank.toString():"higher"}get rank(){return this.shape.length}async buffer(){let t=await this.data();return Zc.buffer(this.shape,this.dtype,t)}bufferSync(){return Zc.buffer(this.shape,this.dtype,this.dataSync())}async array(){let t=await this.data();return ms(this.shape,t,this.dtype==="complex64")}arraySync(){return ms(this.shape,this.dataSync(),this.dtype==="complex64")}async data(){this.throwIfDisposed();let t=go().read(this.dataId);if(this.dtype==="string"){let e=await t;try{return e.map(o=>Yc(o))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}}return t}dataToGPU(t){return this.throwIfDisposed(),go().readToGPU(this.dataId,t)}dataSync(){this.throwIfDisposed();let t=go().readSync(this.dataId);if(this.dtype==="string")try{return t.map(e=>Yc(e))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}return t}async bytes(){this.throwIfDisposed();let t=await go().read(this.dataId);return this.dtype==="string"?t:new Uint8Array(t.buffer)}dispose(){this.isDisposed||(this.kerasMask&&this.kerasMask.dispose(),go().disposeTensor(this),this.isDisposedInternal=!0)}get isDisposed(){return this.isDisposedInternal}throwIfDisposed(){if(this.isDisposed)throw new Error("Tensor is disposed.")}print(t=!1){return Zc.print(this,t)}clone(){return this.throwIfDisposed(),Zc.clone(this)}toString(t=!1){let e=this.dataSync();return oC(e,this.shape,this.dtype,t)}cast(t){return this.throwIfDisposed(),Zc.cast(this,t)}variable(t=!0,e,o){return this.throwIfDisposed(),go().makeVariable(this,t,e,o)}};Object.defineProperty(ee,Symbol.hasInstance,{value:r=>!!r&&r.data!=null&&r.dataSync!=null&&r.throwIfDisposed!=null});px();en=class extends ee{constructor(t,e,o,n){super(t.shape,t.dtype,t.dataId,n),this.trainable=e,this.name=o}assign(t){if(t.dtype!==this.dtype)throw new Error(`dtype of the new value (${t.dtype}) and previous value (${this.dtype}) must match`);if(!Er(t.shape,this.shape))throw new Error(`shape of the new value (${t.shape}) and previous value (${this.shape}) must match`);go().disposeTensor(this),this.dataId=t.dataId,go().incRef(this,null)}dispose(){go().disposeVariable(this),this.isDisposedInternal=!0}};Object.defineProperty(en,Symbol.hasInstance,{value:r=>r instanceof ee&&r.assign!=null&&r.assign instanceof Function})});function be(r,t){if(r==="string"||t==="string"){if(r==="string"&&t==="string")return"string";throw new Error(`Can not upcast ${r} with ${t}`)}return aU[r][t]}function ha(r){return be(r,"int32")}function cm(r){return r!=null&&typeof r=="object"&&"texture"in r&&r.texture instanceof WebGLTexture}function lm(r){return typeof GPUBuffer!="undefined"&&r!=null&&typeof r=="object"&&"buffer"in r&&r.buffer instanceof GPUBuffer}var mx,fx,dx,hx,gx,aU,Qc=h(()=>{(function(r){r.R0="R0",r.R1="R1",r.R2="R2",r.R3="R3",r.R4="R4",r.R5="R5",r.R6="R6"})(mx||(mx={}));(function(r){r.float32="float32",r.int32="int32",r.bool="int32",r.complex64="complex64"})(fx||(fx={}));(function(r){r.float32="float32",r.int32="int32",r.bool="bool",r.complex64="complex64"})(dx||(dx={}));(function(r){r.float32="float32",r.int32="float32",r.bool="float32",r.complex64="complex64"})(hx||(hx={}));(function(r){r.float32="complex64",r.int32="complex64",r.bool="complex64",r.complex64="complex64"})(gx||(gx={}));aU={float32:hx,int32:fx,bool:dx,complex64:gx}});function kt(r,t){if(r.dtype===t.dtype)return[r,t];let e=be(r.dtype,t.dtype);return[r.cast(e),t.cast(e)]}function lC(r,t){$(r.dtype===t.dtype,()=>`The dtypes of the first(${r.dtype}) and second(${t.dtype}) input must match`)}function um(r){let t=[];return uC(r,t,new Set),t}function uC(r,t,e){if(r==null)return;if(r instanceof ee){t.push(r);return}if(!iU(r))return;let o=r;for(let n in o){let s=o[n];e.has(s)||(e.add(s),uC(s,t,e))}}function iU(r){return Array.isArray(r)||typeof r=="object"}var me=h(()=>{Kr();Qc();X();});function xx(r){return r.kernelName!=null}function cU(r){let t=Jl($t(r),"float32");return E.makeTensor(t,r,"float32")}function yx(){let r=Jg();if(r._tfengine==null){let t=new tu(r);r._tfengine=new cu(t)}return Fw(r._tfengine.ENV),aC(()=>r._tfengine),r._tfengine}function lU(r,t){let e={a:r,b:t};return E.runKernel("Add",e)}var pm,cu,E,B=h(()=>{Ug();Ke();Gp();H();rm();Jp();Qw();eC();Kr();me();X();X();pm=class{constructor(){this.registeredVariables={},this.nextTapeNodeId=0,this.numBytes=0,this.numTensors=0,this.numStringTensors=0,this.numDataBuffers=0,this.gradientDepth=0,this.kernelDepth=0,this.scopeStack=[],this.numDataMovesStack=[],this.nextScopeId=0,this.tensorInfo=new WeakMap,this.profiling=!1,this.activeProfile={newBytes:0,newTensors:0,peakBytes:0,kernels:[],result:null,get kernelNames(){return Array.from(new Set(this.kernels.map(t=>t.name)))}}}dispose(){for(let t in this.registeredVariables)this.registeredVariables[t].dispose()}},cu=class r{constructor(t){this.ENV=t,this.registry={},this.registryFactory={},this.pendingBackendInitId=0,this.state=new pm}async ready(){if(this.pendingBackendInit!=null)return this.pendingBackendInit.then(()=>{});if(this.backendInstance!=null)return;let t=this.getSortedBackends();for(let e=0;e<t.length;e++){let o=t[e];if(await this.initializeBackend(o).success){await this.setBackend(o);return}}throw new Error("Could not initialize any backends, all backend initializations failed.")}get backend(){if(this.pendingBackendInit!=null)throw new Error(`Backend '${this.backendName}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);if(this.backendInstance==null){let{name:t,asyncInit:e}=this.initializeBackendsAndReturnBest();if(e)throw new Error(`The highest priority backend '${t}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);this.setBackend(t)}return this.backendInstance}backendNames(){return Object.keys(this.registryFactory)}findBackend(t){if(!(t in this.registry))if(t in this.registryFactory){let{asyncInit:e}=this.initializeBackend(t);if(e)return null}else return null;return this.registry[t]}findBackendFactory(t){return t in this.registryFactory?this.registryFactory[t].factory:null}registerBackend(t,e,o=1){return t in this.registryFactory?(tn(`${t} backend was already registered. Reusing existing backend factory.`),!1):(this.registryFactory[t]={factory:e,priority:o},!0)}async setBackend(t){if(this.registryFactory[t]==null)throw new Error(`Backend name '${t}' not found in registry`);if(this.backendName=t,this.registry[t]==null){this.backendInstance=null;let{success:e,asyncInit:o}=this.initializeBackend(t);if(!(o?await e:e))return!1}return this.backendInstance=this.registry[t],this.setupRegisteredKernels(),this.profiler=new am(this.backendInstance),!0}setupRegisteredKernels(){ox(this.backendName).forEach(e=>{e.setupFunc!=null&&e.setupFunc(this.backendInstance)})}disposeRegisteredKernels(t){ox(t).forEach(o=>{o.disposeFunc!=null&&o.disposeFunc(this.registry[t])})}initializeBackend(t){let e=this.registryFactory[t];if(e==null)throw new Error(`Cannot initialize backend ${t}, no registration found.`);try{let o=e.factory();if(o&&!(o instanceof Qo)&&typeof o.then=="function"){let n=++this.pendingBackendInitId,s=o.then(a=>n<this.pendingBackendInitId?!1:(this.registry[t]=a,this.pendingBackendInit=null,!0)).catch(a=>(n<this.pendingBackendInitId||(this.pendingBackendInit=null,tn(`Initialization of backend ${t} failed`),tn(a.stack||a.message)),!1));return this.pendingBackendInit=s,{success:s,asyncInit:!0}}else return this.registry[t]=o,{success:!0,asyncInit:!1}}catch(o){return tn(`Initialization of backend ${t} failed`),tn(o.stack||o.message),{success:!1,asyncInit:!1}}}removeBackend(t){if(!(t in this.registryFactory))throw new Error(`${t} backend not found in registry`);this.backendName===t&&this.pendingBackendInit!=null&&this.pendingBackendInitId++,t in this.registry&&(this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t]),delete this.registryFactory[t],this.backendName===t&&(this.pendingBackendInit=null,this.backendName=null,this.backendInstance=null)}getSortedBackends(){if(Object.keys(this.registryFactory).length===0)throw new Error("No backend found in registry.");return Object.keys(this.registryFactory).sort((t,e)=>this.registryFactory[e].priority-this.registryFactory[t].priority)}initializeBackendsAndReturnBest(){let t=this.getSortedBackends();for(let e=0;e<t.length;e++){let o=t[e],{success:n,asyncInit:s}=this.initializeBackend(o);if(s||n)return{name:o,asyncInit:s}}throw new Error("Could not initialize any backends, all backend initializations failed.")}moveData(t,e){let o=this.state.tensorInfo.get(e),n=o.backend,s=this.readSync(e),a=n.refCount(e);n.disposeData(e,!0),o.backend=t,t.move(e,s,o.shape,o.dtype,a),this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack[this.state.numDataMovesStack.length-1]++}tidy(t,e){let o=null;if(e==null){if(typeof t!="function")throw new Error("Please provide a function to tidy()");e=t}else{if(typeof t!="string"&&!(t instanceof String))throw new Error("When calling with two arguments, the first argument to tidy() must be a string");if(typeof e!="function")throw new Error("When calling with two arguments, the 2nd argument to tidy() must be a function");o=t}let n;return this.scopedRun(()=>this.startScope(o),()=>this.endScope(n),()=>(n=e(),n instanceof Promise&&console.error("Cannot return a Promise inside of tidy."),n))}scopedRun(t,e,o){t();try{let n=o();return e(),n}catch(n){throw e(),n}}nextTensorId(){return r.nextTensorId++}nextVariableId(){return r.nextVariableId++}clone(t){let e=E.runKernel($n,{x:t}),o={x:t},n=a=>({x:()=>{let i="float32",c={x:a},l={dtype:i};return E.runKernel(En,c,l)}}),s=[];return this.addTapeNode(this.state.activeScope.name,o,[e],n,s,{}),e}runKernel(t,e,o){if(this.backendName==null&&this.backend,!(Hc(t,this.backendName)!=null))throw new Error(`Kernel '${t}' not registered for backend '${this.backendName}'`);return this.runKernelFunc({kernelName:t,inputs:e,attrs:o})}shouldCheckForMemLeaks(){return this.ENV.getBool("IS_TEST")}checkKernelForMemLeak(t,e,o){let n=this.backend.numDataIds(),s=0;o.forEach(c=>{s+=c.dtype==="complex64"?3:1});let a=this.state.numDataMovesStack[this.state.numDataMovesStack.length-1],i=n-e-s-a;if(i>0)throw new Error(`Backend '${this.backendName}' has an internal memory leak (${i} data ids) after running '${t}'`)}runKernelFunc(t){let e,o=[],n=this.isTapeOn(),s=this.state.numBytes,a=this.state.numTensors;this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack.push(0);let i;this.backendName==null&&this.backend;let c,l=xx(t)?t.kernelName:this.state.activeScope!=null?this.state.activeScope.name:"";if(xx(t)){let{kernelName:d,inputs:x,attrs:g}=t;this.backendName==null&&this.backend;let y=Hc(d,this.backendName);$(y!=null,()=>`Cannot find registered kernel '${d}' for backend '${this.backendName}'`),i=()=>{let v=this.backend.numDataIds();c=y.kernelFunc({inputs:x,attrs:g,backend:this.backend});let N=Array.isArray(c)?c:[c];this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(d,v,N);let S=N.map(R=>R.rank!=null?R:this.makeTensorFromTensorInfo(R));if(n){let R=this.getTensorsForGradient(d,x,S);o=this.saveTensorsForBackwardMode(R)}return S}}else{let{forwardFunc:d}=t,x=g=>{n&&(o=g.map(y=>this.keep(this.clone(y))))};i=()=>{let g=this.backend.numDataIds();c=this.tidy(()=>d(this.backend,x));let y=Array.isArray(c)?c:[c];return this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(l,g,y),y}}let{inputs:u,attrs:p}=t,m=xx(t)?null:t.backwardsFunc,f;return this.scopedRun(()=>this.state.kernelDepth++,()=>this.state.kernelDepth--,()=>{!this.ENV.getBool("DEBUG")&&!this.state.profiling?e=i():(f=this.profiler.profileKernel(l,u,()=>i()),this.ENV.getBool("DEBUG")&&this.profiler.logKernelProfile(f),e=f.outputs)}),n&&this.addTapeNode(l,u,e,m,o,p),this.state.profiling&&this.state.activeProfile.kernels.push({name:l,bytesAdded:this.state.numBytes-s,totalBytesSnapshot:this.state.numBytes,tensorsAdded:this.state.numTensors-a,totalTensorsSnapshot:this.state.numTensors,inputShapes:Object.keys(u).map(d=>u[d]!=null?u[d].shape:null),outputShapes:e.map(d=>d.shape),kernelTimeMs:f.timeMs,extraInfo:f.extraInfo}),Array.isArray(c)?e:e[0]}saveTensorsForBackwardMode(t){return t.map(o=>this.keep(this.clone(o)))}getTensorsForGradient(t,e,o){let n=rx(t);if(n!=null){let s=n.inputsToSave||[],a=n.outputsToSave||[],i;n.saveAllInputs?($(Array.isArray(e),()=>"saveAllInputs is true, expected inputs to be an array."),i=Object.keys(e).map(l=>e[l])):i=s.map(l=>e[l]);let c=o.filter((l,u)=>a[u]);return i.concat(c)}return[]}makeTensor(t,e,o,n){if(t==null)throw new Error("Values passed to engine.makeTensor() are null");o=o||"float32",n=n||this.backend;let s=t;o==="string"&&li(t[0])&&(s=t.map(c=>jc(c)));let a=n.write(s,e,o),i=new ee(e,o,a,this.nextTensorId());if(this.trackTensor(i,n),o==="string"){let c=this.state.tensorInfo.get(a),l=Yg(s);this.state.numBytes+=l-c.bytes,c.bytes=l}return i}makeTensorFromDataId(t,e,o,n){o=o||"float32";let s={dataId:t,shape:e,dtype:o};return this.makeTensorFromTensorInfo(s,n)}makeTensorFromTensorInfo(t,e){let{dataId:o,shape:n,dtype:s}=t,a=new ee(n,s,o,this.nextTensorId());return this.trackTensor(a,e),a}makeVariable(t,e=!0,o,n){o=o||this.nextVariableId().toString(),n!=null&&n!==t.dtype&&(t=t.cast(n));let s=new en(t,e,o,this.nextTensorId());if(this.state.registeredVariables[s.name]!=null)throw new Error(`Variable with name ${s.name} was already registered`);return this.state.registeredVariables[s.name]=s,this.incRef(s,this.backend),s}trackTensor(t,e){this.state.numTensors++,t.dtype==="string"&&this.state.numStringTensors++;let o=0;t.dtype!=="complex64"&&t.dtype!=="string"&&(o=t.size*ci(t.dtype)),this.state.numBytes+=o,this.state.tensorInfo.has(t.dataId)||(this.state.numDataBuffers++,this.state.tensorInfo.set(t.dataId,{backend:e||this.backend,dtype:t.dtype,shape:t.shape,bytes:o})),t instanceof en||this.track(t)}incRef(t,e){this.trackTensor(t,e),this.backend.incRef(t.dataId)}removeDataId(t,e){this.state.tensorInfo.has(t)&&this.state.tensorInfo.get(t).backend===e&&(this.state.tensorInfo.delete(t),this.state.numDataBuffers--)}disposeTensor(t){if(!this.state.tensorInfo.has(t.dataId))return;let e=this.state.tensorInfo.get(t.dataId);if(this.state.numTensors--,t.dtype==="string"&&(this.state.numStringTensors--,this.state.numBytes-=e.bytes),t.dtype!=="complex64"&&t.dtype!=="string"){let o=t.size*ci(t.dtype);this.state.numBytes-=o}e.backend.disposeData(t.dataId)&&this.removeDataId(t.dataId,e.backend)}disposeVariables(){for(let t in this.state.registeredVariables){let e=this.state.registeredVariables[t];this.disposeVariable(e)}}disposeVariable(t){this.disposeTensor(t),this.state.registeredVariables[t.name]!=null&&delete this.state.registeredVariables[t.name]}memory(){let t=this.backend.memory();return t.numTensors=this.state.numTensors,t.numDataBuffers=this.state.numDataBuffers,t.numBytes=this.state.numBytes,this.state.numStringTensors>0&&(t.unreliable=!0,t.reasons==null&&(t.reasons=[]),t.reasons.push("Memory usage by string tensors is approximate (2 bytes per character)")),t}async profile(t){this.state.profiling=!0;let e=this.state.numBytes,o=this.state.numTensors;this.state.activeProfile.kernels=[],this.state.activeProfile.result=await t(),this.state.profiling=!1,this.state.activeProfile.peakBytes=Math.max(...this.state.activeProfile.kernels.map(n=>n.totalBytesSnapshot)),this.state.activeProfile.newBytes=this.state.numBytes-e,this.state.activeProfile.newTensors=this.state.numTensors-o;for(let n of this.state.activeProfile.kernels)n.kernelTimeMs=await n.kernelTimeMs,n.extraInfo=await n.extraInfo;return this.state.activeProfile}isTapeOn(){return this.state.gradientDepth>0&&this.state.kernelDepth===0}addTapeNode(t,e,o,n,s,a){let i={id:this.state.nextTapeNodeId++,kernelName:t,inputs:e,outputs:o,saved:s},c=rx(t);c!=null&&(n=c.gradFunc),n!=null&&(i.gradient=l=>(l=l.map((u,p)=>{if(u==null){let m=o[p],f=mi(m.size,m.dtype);return this.makeTensor(f,m.shape,m.dtype)}return u}),n(l.length>1?l:l[0],s,a))),this.state.activeTape.push(i)}keep(t){return t.kept=!0,t}startTape(){this.state.gradientDepth===0&&(this.state.activeTape=[]),this.state.gradientDepth++}endTape(){this.state.gradientDepth--}startScope(t){let e={track:[],name:"unnamed scope",id:this.state.nextScopeId++};t&&(e.name=t),this.state.scopeStack.push(e),this.state.activeScope=e}endScope(t){let e=um(t),o=new Set(e.map(s=>s.id));for(let s=0;s<this.state.activeScope.track.length;s++){let a=this.state.activeScope.track[s];!a.kept&&!o.has(a.id)&&a.dispose()}let n=this.state.scopeStack.pop();this.state.activeScope=this.state.scopeStack.length===0?null:this.state.scopeStack[this.state.scopeStack.length-1],e.forEach(s=>{!s.kept&&s.scopeId===n.id&&this.track(s)})}gradients(t,e,o,n=!1){if($(e.length>0,()=>"gradients() received an empty list of xs."),o!=null&&o.dtype!=="float32")throw new Error(`dy must have 'float32' dtype, but has '${o.dtype}'`);let s=this.scopedRun(()=>this.startTape(),()=>this.endTape(),()=>this.tidy("forward",t));$(s instanceof ee,()=>"The result y returned by f() must be a tensor.");let a=Jw(this.state.activeTape,e,s);if(!n&&a.length===0&&e.length>0)throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that the f you passed encloses all operations that lead from x to y.");return this.tidy("backward",()=>{let i={};i[s.id]=o==null?cU(s.shape):o,tC(i,a,l=>this.tidy(l),lU);let c=e.map(l=>i[l.id]);return this.state.gradientDepth===0&&(this.state.activeTape.forEach(l=>{for(let u of l.saved)u.dispose()}),this.state.activeTape=null),{value:s,grads:c}})}customGrad(t){return $(ui(t),()=>"The f passed in customGrad(f) must be a function."),(...e)=>{$(e.every(i=>i instanceof ee),()=>"The args passed in customGrad(f)(x1, x2,...) must all be tensors");let o,n={};e.forEach((i,c)=>{n[c]=i});let s=(i,c)=>(o=t(...e,c),$(o.value instanceof ee,()=>"The function f passed in customGrad(f) must return an object where `obj.value` is a tensor"),$(ui(o.gradFunc),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function."),o.value),a=(i,c)=>{let l=o.gradFunc(i,c),u=Array.isArray(l)?l:[l];$(u.length===e.length,()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns the same number of tensors as inputs passed to f(...)."),$(u.every(m=>m instanceof ee),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns a list of only tensors.");let p={};return u.forEach((m,f)=>{p[f]=()=>m}),p};return this.runKernelFunc({forwardFunc:s,backwardsFunc:a,inputs:n})}}readSync(t){return this.state.tensorInfo.get(t).backend.readSync(t)}read(t){return this.state.tensorInfo.get(t).backend.read(t)}readToGPU(t,e){return this.state.tensorInfo.get(t).backend.readToGPU(t,e)}async time(t){let e=da(),o=await this.backend.time(t);return o.wallMs=da()-e,o}track(t){return this.state.activeScope!=null&&(t.scopeId=this.state.activeScope.id,this.state.activeScope.track.push(t)),t}get registeredVariables(){return this.state.registeredVariables}reset(){this.pendingBackendInitId++,this.state.dispose(),this.ENV.reset(),this.state=new pm;for(let t in this.registry)this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t];this.backendName=null,this.backendInstance=null,this.pendingBackendInit=null}};cu.nextTensorId=0;cu.nextVariableId=0;E=yx()});var Fn={};Yt(Fn,{isBrowser:()=>vx,isMobile:()=>mU,mockIsMobile:()=>pU});function uU(){return typeof navigator!="undefined"&&navigator!=null}function pU(r){bx=r}function mU(r){if(bx!==void 0)return bx;if(r||uU()){if(r||(r=navigator),r.product==="ReactNative")return!0;let t=r.userAgent||r.vendor||(typeof window!="undefined"?window.opera:"");if(!t){let e=r;return e.userAgentData&&e.userAgentData.mobile}return/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(t)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(t.substr(0,4))}return!1}function vx(){return typeof window!="undefined"&&window.document!=null||typeof WorkerGlobalScope!="undefined"}var bx,wx=h(()=>{});var ur,Jc=h(()=>{B();wx();Ke();ur=O();ur.registerFlag("DEBUG",()=>!1,r=>{r&&console.warn("Debugging mode is ON. The output of every math call will be downloaded to CPU and checked for NaNs. This significantly impacts performance.")});ur.registerFlag("IS_BROWSER",()=>vx());ur.registerFlag("IS_NODE",()=>typeof process!="undefined"&&typeof process.versions!="undefined"&&typeof process.versions.node!="undefined");ur.registerFlag("IS_CHROME",()=>typeof navigator!="undefined"&&navigator!=null&&navigator.userAgent!=null&&/Chrome/.test(navigator.userAgent)&&/Google Inc/.test(navigator.vendor));ur.registerFlag("IS_SAFARI",()=>typeof navigator!="undefined"&&navigator!=null&&navigator.userAgent!=null&&/Safari/.test(navigator.userAgent)&&/Apple/.test(navigator.vendor));ur.registerFlag("PROD",()=>!1);ur.registerFlag("TENSORLIKE_CHECK_SHAPE_CONSISTENCY",()=>ur.getBool("DEBUG"));ur.registerFlag("DEPRECATION_WARNINGS_ENABLED",()=>!0);ur.registerFlag("IS_TEST",()=>!1);ur.registerFlag("CHECK_COMPUTATION_FOR_ERRORS",()=>ur.getBool("DEBUG"));ur.registerFlag("WRAP_TO_IMAGEBITMAP",()=>!1);ur.registerFlag("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU",()=>!1);ur.registerFlag("USE_SETTIMEOUTCUSTOM",()=>!1)});function pr(r,t){let e=r;if(er(r))return t==="string"?[]:[r.length];if(cm(r)){let n=r.channels||"RGBA";return[r.height,r.width*n.length]}else if(lm(r))return[r.buffer.size/(t==null?4:ci(t))];if(!Array.isArray(r))return[];let o=[];for(;Array.isArray(e)||er(e)&&t!=="string";)o.push(e.length),e=e[0];return Array.isArray(r)&&O().getBool("TENSORLIKE_CHECK_SHAPE_CONSISTENCY")&&mC(r,o,[]),o}function mC(r,t,e){if(e=e||[],!Array.isArray(r)&&!er(r)){$(t.length===0,()=>`Element arr[${e.join("][")}] is a primitive, but should be an array/TypedArray of ${t[0]} elements`);return}$(t.length>0,()=>`Element arr[${e.join("][")}] should be a primitive, but is an array of ${r.length} elements`),$(r.length===t[0],()=>`Element arr[${e.join("][")}] should have ${t[0]} elements, but has ${r.length} elements`);let o=t.slice(1);for(let n=0;n<r.length;++n)mC(r[n],o,e.concat(n))}function pC(r,t,e,o){if(r!=="string_or_numeric"){if(r==null)throw new Error("Expected dtype cannot be null.");if(r!=="numeric"&&r!==t||r==="numeric"&&t==="string")throw new Error(`Argument '${e}' passed to '${o}' must be ${r} tensor, but got ${t} tensor`)}}function C(r,t,e,o="numeric"){if(r instanceof px())return pC(o,r.dtype,t,e),r;let n=kn(r);if(n!=="string"&&["bool","int32","float32"].indexOf(o)>=0&&(n=o),pC(o,n,t,e),r==null||!er(r)&&!Array.isArray(r)&&typeof r!="number"&&typeof r!="boolean"&&typeof r!="string"){let c=r==null?"null":r.constructor.name;throw new Error(`Argument '${t}' passed to '${e}' must be a Tensor or TensorLike, but got '${c}'`)}let s=pr(r,n);!er(r)&&!Array.isArray(r)&&(r=[r]);let i=n!=="string"?Xc(r,n):Dn(r,[],!0);return E.makeTensor(i,s,n)}function xa(r,t,e,o="numeric"){if(!Array.isArray(r))throw new Error(`Argument ${t} passed to ${e} must be a \`Tensor[]\` or \`TensorLike[]\``);return r.map((s,a)=>C(s,`${t}[${a}]`,e,o))}var P=h(()=>{B();Ke();Kr();Qc();X();Re();});function T(r){let t=Object.keys(r);if(t.length!==1)throw new Error(`Please provide an object with a single key (operation name) mapping to a function. Got an object with ${t.length} keys.`);let e=t[0],o=r[e];e.endsWith("_")&&(e=e.substring(0,e.length-1)),e=e+Cx;let n=(...s)=>{E.startScope(e);try{let a=o(...s);return ds(a)&&console.error("Cannot return a Promise inside of tidy."),E.endScope(a),a}catch(a){throw E.endScope(null),a}};return Object.defineProperty(n,"name",{value:e,configurable:!0}),n}var Cx,F=h(()=>{B();X();Cx="__op"});function fU(r,t){let e=C(r,"real","complex"),o=C(t,"imag","complex");fe(e.shape,o.shape,`real and imag shapes, ${e.shape} and ${o.shape}, must match in call to tf.complex().`);let n={real:e,imag:o};return E.runKernel(Ci,n)}var mr,On=h(()=>{B();H();P();X();F();mr=T({complex_:fU})});function ar(r,t,e,o){if(o==null)o=kn(r);else if(o==="complex64")throw new Error("Cannot construct a complex64 tensor directly. Please use tf.complex(real, imag).");if(lm(r)||cm(r)){if(o!=="float32"&&o!=="int32")throw new Error(`Creating tensor from GPU data only supports 'float32'|'int32' dtype, while the dtype is ${o}.`);return E.backend.createTensorFromGPUData(r,t||e,o)}if(!er(r)&&!Array.isArray(r)&&typeof r!="number"&&typeof r!="boolean"&&typeof r!="string")throw new Error("values passed to tensor(values) must be a number/boolean/string or an array of numbers/booleans/strings, or a TypedArray");if(t!=null){oe(t);let n=$t(t),s=$t(e);$(n===s,()=>`Based on the provided shape, [${t}], the tensor should have ${n} values but has ${s}`);for(let a=0;a<e.length;++a){let i=e[a],c=a===e.length-1?i!==$t(t.slice(a)):!0;$(e[a]===t[a]||!c,()=>`Error creating a new Tensor. Inferred shape (${e}) does not match the provided shape (${t}). `)}}return!er(r)&&!Array.isArray(r)&&(r=[r]),t=t||e,r=o!=="string"?Xc(r,o):Dn(r,[],!0),E.makeTensor(r,t,o)}var rn=h(()=>{B();Qc();X();});function ir(r,t,e){let o=pr(r,e);return ar(r,t,o,e)}var lu=h(()=>{P();rn();});var on,Sx=h(()=>{on={float32:4,float16:2,int32:4,uint16:2,uint8:1,bool:1,complex64:8}});function dU(r,t){let e=0,o=r.length;for(;e<=o;){let n=Math.floor((o-e)/2)+e,s=t(r[n]);if(s===0)return n;s<0?o=n:e=n+1}return-1}var qe,Pn=h(()=>{X();qe=class r{static join(t){return new r(t).slice()}constructor(t){if(this.shards=[],this.previousShardIndex=0,t==null||(t instanceof Array||(t=[t]),t=t.map(o=>er(o)?o.buffer:o),t.length===0))return;this.bufferUniformSize=t[0].byteLength;let e=0;for(let o=0;o<t.length;o++){let n=t[o];o!==t.length-1&&n.byteLength!==this.bufferUniformSize&&(this.bufferUniformSize=void 0);let s=e+n.byteLength;this.shards.push({buffer:n,start:e,end:s}),e=s}this.shards.length===0&&(this.byteLength=0),this.byteLength=this.shards[this.shards.length-1].end}slice(t=0,e=this.byteLength){if(this.shards.length===0)return new ArrayBuffer(0);if(t=isNaN(Number(t))?0:t,e=isNaN(Number(e))?0:e,t=Math.max(0,t),e=Math.min(this.byteLength,e),e<=t)return new ArrayBuffer(0);let o=this.findShardForByte(t);if(o===-1)throw new Error(`Could not find start shard for byte ${t}`);let n=e-t,s=new ArrayBuffer(n),a=new Uint8Array(s),i=0;for(let c=o;c<this.shards.length;c++){let l=this.shards[c],p=t+i-l.start,m=i,d=Math.min(e,l.end)-l.start,x=new Uint8Array(l.buffer,p,d-p);if(a.set(x,m),i+=x.length,e<l.end)break}return s}findShardForByte(t){if(this.shards.length===0||t<0||t>=this.byteLength)return-1;if(this.bufferUniformSize!=null)return this.previousShardIndex=Math.floor(t/this.bufferUniformSize),this.previousShardIndex;function e(n){return t<n.start?-1:t>=n.end?1:0}if(e(this.shards[this.previousShardIndex])===0)return this.previousShardIndex;let o=dU(this.shards,e);return o===-1?-1:(this.previousShardIndex=o,this.previousShardIndex)}}});function hU(r){O().getBool("DEPRECATION_WARNINGS_ENABLED")&&console.warn(r+" You can disable deprecation warnings with tf.disableDeprecationWarnings().")}function ro(){return E}function Nx(){return E.memory()}function Tt(r,t){return E.tidy(r,t)}function se(r){um(r).forEach(e=>e.dispose())}function fr(r){return E.keep(r)}function uu(r){return E.setBackend(r)}function pu(){return E.ready()}function ya(){return E.backendName}function mm(r,t,e=1){return E.registerBackend(r,t,e)}function Tx(){return E.backend}var Ar=h(()=>{B();Ke();Kr();me();cC(hU)});async function hC(r,t){let e=[],o=[],n=Array.isArray(r)?r.map(a=>a.name):Object.keys(r);for(let a=0;a<n.length;++a){let i=n[a],c=Array.isArray(r)?r[a].tensor:r[i];if(c.dtype!=="float32"&&c.dtype!=="int32"&&c.dtype!=="bool"&&c.dtype!=="string"&&c.dtype!=="complex64")throw new Error(`Unsupported dtype in weight '${i}': ${c.dtype}`);let l={name:i,shape:c.shape,dtype:c.dtype};if(c.dtype==="string"){let u=new Promise(async p=>{let m=await c.bytes(),f=m.reduce((g,y)=>g+y.length,0)+Ln*m.length,d=new Uint8Array(f),x=0;for(let g=0;g<m.length;g++){let y=m[g],v=new Uint8Array(new Uint32Array([y.length]).buffer);d.set(v,x),x+=Ln,d.set(y,x),x+=y.length}p(d)});o.push(u)}else o.push(c.data());t!=null&&(l.group=t),e.push(l)}let s=await Promise.all(o);return{data:yU(s),specs:e}}function fm(r,t){let e=new qe(r),o={},n=0;for(let s of t){let a=gU(s,(i,c)=>e.slice(n+i,n+c));o[s.name]=gC(s,e.slice(n,n+a)),n+=a}return o}function gU(r,t){let e=$t(r.shape),o;if("quantization"in r){let n=r.quantization;o=on[n.dtype]}else if(r.dtype==="string"){let n=0;for(let s=0;s<e;s++)n+=Ln+new Uint32Array(t(n,n+Ln))[0];return n}else o=on[r.dtype];return e*o}async function xU(r,t){let e=$t(r.shape),o;if("quantization"in r){let n=r.quantization;o=on[n.dtype]}else if(r.dtype==="string"){let n=0;for(let s=0;s<e;s++)n+=Ln+new Uint32Array(await t(n,n+Ln))[0];return n}else o=on[r.dtype];return e*o}function gC(r,t){let e=r.name,o=r.dtype,n=r.shape,s=$t(n),a,i=0;if("quantization"in r){let c=r.quantization;if(c.dtype==="uint8"||c.dtype==="uint16"){if(!("min"in c&&"scale"in c))throw new Error(`Weight ${r.name} with quantization ${c.dtype} doesn't have corresponding metadata min and scale.`)}else if(c.dtype==="float16"){if(o!=="float32")throw new Error(`Weight ${r.name} is quantized with ${c.dtype} which only supports weights of type float32 not ${o}.`)}else throw new Error(`Weight ${r.name} has unknown quantization dtype ${c.dtype}. Supported quantization dtypes are: 'uint8', 'uint16', and 'float16'.`);let l=on[c.dtype],u=c.dtype==="uint8"?new Uint8Array(t):new Uint16Array(t);if(o==="float32")if(c.dtype==="uint8"||c.dtype==="uint16"){a=new Float32Array(u.length);for(let p=0;p<u.length;p++){let m=u[p];a[p]=m*c.scale+c.min}}else if(c.dtype==="float16")a=CU()(u);else throw new Error(`Unsupported quantization type ${c.dtype} for weight type float32.`);else if(o==="int32"){if(c.dtype!=="uint8"&&c.dtype!=="uint16")throw new Error(`Unsupported quantization type ${c.dtype} for weight type int32.`);a=new Int32Array(u.length);for(let p=0;p<u.length;p++){let m=u[p];a[p]=Math.round(m*c.scale+c.min)}}else throw new Error(`Unsupported dtype in weight '${e}': ${o}`);i+=s*l}else if(o==="string"){let c=$t(r.shape);a=[];for(let l=0;l<c;l++){let u=new Uint32Array(t.slice(i,i+Ln))[0];i+=Ln;let p=new Uint8Array(t.slice(i,i+u));a.push(p),i+=u}}else{let c=on[o];if(o==="float32")a=new Float32Array(t);else if(o==="int32")a=new Int32Array(t);else if(o==="bool")a=new Uint8Array(t);else if(o==="complex64"){a=new Float32Array(t);let l=new Float32Array(a.length/2),u=new Float32Array(a.length/2);for(let d=0;d<l.length;d++)l[d]=a[d*2],u[d]=a[d*2+1];let p=ir(l,n,"float32"),m=ir(u,n,"float32"),f=mr(p,m);return p.dispose(),m.dispose(),f}else throw new Error(`Unsupported dtype in weight '${e}': ${o}`);i+=s*c}return ir(a,n,o)}async function fC(r,t,e){let o=new Uint8Array(t);for(;o.byteLength<e;){let{done:n,value:s}=await r.read();if(n&&s==null){let i=e-o.byteLength;throw new Error(`Reader is done but ${i} bytes are still expected`)}let a=new Uint8Array(o.length+s.byteLength);a.set(o,0),a.set(new Uint8Array(s),o.length),o=a}return o.buffer}async function dm(r,t){let e={},o=r.getReader(),n=new ArrayBuffer(0);for(let s of t){let a=await xU(s,async(l,u)=>(n=await fC(o,n,u),n.slice(l,u)));n=await fC(o,n,a);let i=n.slice(0,a);n=n.slice(a);let c=gC(s,i);if(e[s.name]=c,ya()==="webgpu"){let l=Tx();"uploadToGPU"in l&&$t(c.shape)>=O().get("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD")&&l.uploadToGPU(c.dataId)}}return e}function yU(r){if(r===null)throw new Error(`Invalid input value: ${JSON.stringify(r)}`);let t=0,e=[];r.forEach(s=>{if(t+=s.byteLength,e.push(s.byteLength===s.buffer.byteLength?s:new s.constructor(s)),!(s instanceof Float32Array||s instanceof Int32Array||s instanceof Uint8Array))throw new Error(`Unsupported TypedArray subtype: ${s.constructor.name}`)});let o=new Uint8Array(t),n=0;return e.forEach(s=>{o.set(new Uint8Array(s.buffer),n),n+=s.byteLength}),o.buffer}function dC(r){return Ix?Buffer.byteLength(r,"utf8"):new Blob([r]).size}function xC(r){if(Ix)return Buffer.from(r).toString("base64");let t=new Uint8Array(r),e="";for(let o=0,n=t.length;o<n;o++)e+=String.fromCharCode(t[o]);return btoa(e)}function yC(r){if(Ix){let o=Buffer.from(r,"base64");return o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength)}let t=atob(r),e=new Uint8Array(t.length);for(let o=0;o<t.length;++o)e.set([t.charCodeAt(o)],o);return e.buffer}function bC(r){return qe.join(r)}function kx(r){for(r=r.trim();r.endsWith("/");)r=r.slice(0,r.length-1);let e=r.split("/");return e[e.length-1]}function hm(r,t){let e={modelTopology:r.modelTopology,format:r.format,generatedBy:r.generatedBy,convertedBy:r.convertedBy,weightsManifest:t};return r.signature!=null&&(e.signature=r.signature),r.userDefinedMetadata!=null&&(e.userDefinedMetadata=r.userDefinedMetadata),r.modelInitializer!=null&&(e.modelInitializer=r.modelInitializer),r.initializerSignature!=null&&(e.initializerSignature=r.initializerSignature),r.trainingConfig!=null&&(e.trainingConfig=r.trainingConfig),e}function Ex(r,t,e){let o={modelTopology:r.modelTopology,format:r.format,generatedBy:r.generatedBy,convertedBy:r.convertedBy};if(r.trainingConfig!=null&&(o.trainingConfig=r.trainingConfig),r.weightsManifest!=null){if(!t)throw new Error("modelJSON has weightsManifest but weightSpecs is null");if(!e)throw new Error("modelJSON has weightsManifest but weightData is null");o.weightSpecs=t,o.weightData=e}return r.signature!=null&&(o.signature=r.signature),r.userDefinedMetadata!=null&&(o.userDefinedMetadata=r.userDefinedMetadata),r.modelInitializer!=null&&(o.modelInitializer=r.modelInitializer),r.initializerSignature!=null&&(o.initializerSignature=r.initializerSignature),o}async function tl(r,t){let e,o;return r.weightsManifest!=null&&([e,o]=await t(r.weightsManifest)),Ex(r,e,o)}function _o(r){if(r.modelTopology instanceof ArrayBuffer)throw new Error("Expected JSON model topology, received ArrayBuffer.");return{dateSaved:new Date,modelTopologyType:"JSON",modelTopologyBytes:r.modelTopology==null?0:dC(JSON.stringify(r.modelTopology)),weightSpecsBytes:r.weightSpecs==null?0:dC(JSON.stringify(r.weightSpecs)),weightDataBytes:r.weightData==null?0:new qe(r.weightData).byteLength}}function mu(r){let t=[];for(let e of r)t.push(...e.weights);return t}function bU(){let r=e=>{let o=e<<13,n=0;for(;(o&8388608)===0;)n-=8388608,o<<=1;return o&=-8388609,n+=947912704,o|n},t=new Uint32Array(2048);t[0]=0;for(let e=1;e<1024;e++)t[e]=r(e);for(let e=1024;e<2048;e++)t[e]=939524096+(e-1024<<13);return t}function vU(){let r=new Uint32Array(64);r[0]=0,r[31]=1199570944,r[32]=2147483648,r[63]=3347054592;for(let t=1;t<31;t++)r[t]=t<<23;for(let t=33;t<63;t++)r[t]=2147483648+(t-32<<23);return r}function wU(){let r=new Uint32Array(64);for(let t=0;t<64;t++)r[t]=1024;return r[0]=r[32]=0,r}function CU(){let r=bU(),t=vU(),e=wU();return o=>{let n=new ArrayBuffer(4*o.length),s=new Uint32Array(n);for(let a=0;a<o.length;a++){let i=o[a],c=r[e[i>>10]+(i&1023)]+t[i>>10];s[a]=c}return new Float32Array(n)}}var Ln,Ix,Mn=h(()=>{On();lu();X();Sx();Pn();Ar();Ke();Ar();Ln=4;Ix=typeof Buffer!="undefined"&&(typeof Blob=="undefined"||typeof atob=="undefined"||typeof btoa=="undefined")});var Ae,vC,wC,CC,SC,ba=h(()=>{Ae=class r{constructor(){this.saveRouters=[],this.loadRouters=[]}static getInstance(){return r.instance==null&&(r.instance=new r),r.instance}static registerSaveRouter(t){r.getInstance().saveRouters.push(t)}static registerLoadRouter(t){r.getInstance().loadRouters.push(t)}static getSaveHandlers(t){return r.getHandlers(t,"save")}static getLoadHandlers(t,e){return r.getHandlers(t,"load",e)}static getHandlers(t,e,o){let n=[];return(e==="load"?r.getInstance().loadRouters:r.getInstance().saveRouters).forEach(a=>{let i=a(t,o);i!==null&&n.push(i)}),n}},vC=r=>Ae.registerSaveRouter(r),wC=r=>Ae.registerLoadRouter(r),CC=r=>Ae.getSaveHandlers(r),SC=(r,t)=>Ae.getLoadHandlers(r,t)});function NC(){if(!O().getBool("IS_BROWSER"))throw new Error("Failed to obtain IndexedDB factory because the current environmentis not a web browser.");let r=typeof window=="undefined"?self:window,t=r.indexedDB||r.mozIndexedDB||r.webkitIndexedDB||r.msIndexedDB||r.shimIndexedDB;if(t==null)throw new Error("The current browser does not appear to support IndexedDB.");return t}function Ax(r){let t=r.result;t.createObjectStore(va,{keyPath:"modelPath"}),t.createObjectStore(Bn,{keyPath:"modelPath"})}function SU(r){return new Do(r)}function NU(r){return r.startsWith(Do.URL_SCHEME)?r.slice(Do.URL_SCHEME.length):r}var $x,Rx,va,Bn,Do,TC,gm,_x=h(()=>{Jc();Ke();Mn();ba();Pn();$x="tensorflowjs",Rx=1,va="models_store",Bn="model_info_store";Do=class{constructor(t){if(this.indexedDB=NC(),t==null||!t)throw new Error("For IndexedDB, modelPath must not be null, undefined or empty.");this.modelPath=t}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");return this.databaseAction(this.modelPath,t)}async load(){return this.databaseAction(this.modelPath)}databaseAction(t,e){return new Promise((o,n)=>{let s=this.indexedDB.open($x,Rx);s.onupgradeneeded=()=>Ax(s),s.onsuccess=()=>{let a=s.result;if(e==null){let i=a.transaction(va,"readonly"),l=i.objectStore(va).get(this.modelPath);l.onsuccess=()=>{if(l.result==null)return a.close(),n(new Error(`Cannot find model with path '${this.modelPath}' in IndexedDB.`));o(l.result.modelArtifacts)},l.onerror=u=>(a.close(),n(l.error)),i.oncomplete=()=>a.close()}else{e.weightData=qe.join(e.weightData);let i=_o(e),c=a.transaction(Bn,"readwrite"),l=c.objectStore(Bn),u;try{u=l.put({modelPath:this.modelPath,modelArtifactsInfo:i})}catch(m){return n(m)}let p;u.onsuccess=()=>{p=a.transaction(va,"readwrite");let m=p.objectStore(va),f;try{f=m.put({modelPath:this.modelPath,modelArtifacts:e,modelArtifactsInfo:i})}catch(d){return n(d)}f.onsuccess=()=>o({modelArtifactsInfo:i}),f.onerror=d=>{l=c.objectStore(Bn);let x=l.delete(this.modelPath);x.onsuccess=()=>(a.close(),n(f.error)),x.onerror=g=>(a.close(),n(f.error))}},u.onerror=m=>(a.close(),n(u.error)),c.oncomplete=()=>{p==null?a.close():p.oncomplete=()=>a.close()}}},s.onerror=a=>n(s.error)})}};Do.URL_SCHEME="indexeddb://";TC=r=>O().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(Do.URL_SCHEME)?SU(r.slice(Do.URL_SCHEME.length)):null;Ae.registerSaveRouter(TC);Ae.registerLoadRouter(TC);gm=class{constructor(){this.indexedDB=NC()}async listModels(){return new Promise((t,e)=>{let o=this.indexedDB.open($x,Rx);o.onupgradeneeded=()=>Ax(o),o.onsuccess=()=>{let n=o.result,s=n.transaction(Bn,"readonly"),i=s.objectStore(Bn).getAll();i.onsuccess=()=>{let c={};for(let l of i.result)c[l.modelPath]=l.modelArtifactsInfo;t(c)},i.onerror=c=>(n.close(),e(i.error)),s.oncomplete=()=>n.close()},o.onerror=n=>e(o.error)})}async removeModel(t){return t=NU(t),new Promise((e,o)=>{let n=this.indexedDB.open($x,Rx);n.onupgradeneeded=()=>Ax(n),n.onsuccess=()=>{let s=n.result,a=s.transaction(Bn,"readwrite"),i=a.objectStore(Bn),c=i.get(t),l;c.onsuccess=()=>{if(c.result==null)return s.close(),o(new Error(`Cannot find model with path '${t}' in IndexedDB.`));{let u=i.delete(t),p=()=>{l=s.transaction(va,"readwrite");let f=l.objectStore(va).delete(t);f.onsuccess=()=>e(c.result.modelArtifactsInfo),f.onerror=d=>o(c.error)};u.onsuccess=p,u.onerror=m=>(p(),s.close(),o(c.error))}},c.onerror=u=>(s.close(),o(c.error)),a.oncomplete=()=>{l==null?s.close():l.oncomplete=()=>s.close()}},n.onerror=s=>o(n.error)})}}});function kC(r){return{info:[el,r,IC].join(nn),topology:[el,r,TU].join(nn),weightSpecs:[el,r,IU].join(nn),weightData:[el,r,kU].join(nn),modelMetadata:[el,r,EU].join(nn)}}function EC(r){for(let t of Object.values(r))window.localStorage.removeItem(t)}function $U(r){let t=r.split(nn);if(t.length<3)throw new Error(`Invalid key format: ${r}`);return t.slice(1,t.length-1).join(nn)}function RU(r){return r.startsWith(Fo.URL_SCHEME)?r.slice(Fo.URL_SCHEME.length):r}function AU(r){return new Fo(r)}var nn,el,IC,TU,IU,kU,EU,Fo,$C,xm,Dx=h(()=>{Jc();Ke();X();Mn();Pn();ba();nn="/",el="tensorflowjs_models",IC="info",TU="model_topology",IU="weight_specs",kU="weight_data",EU="model_metadata";Fo=class{constructor(t){if(!O().getBool("IS_BROWSER")||typeof window=="undefined"||typeof window.localStorage=="undefined")throw new Error("The current environment does not support local storage.");if(this.LS=window.localStorage,t==null||!t)throw new Error("For local storage, modelPath must not be null, undefined or empty.");this.modelPath=t,this.keys=kC(this.modelPath)}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");{let e=JSON.stringify(t.modelTopology),o=JSON.stringify(t.weightSpecs),n=_o(t),s=qe.join(t.weightData);try{this.LS.setItem(this.keys.info,JSON.stringify(n)),this.LS.setItem(this.keys.topology,e),this.LS.setItem(this.keys.weightSpecs,o),this.LS.setItem(this.keys.weightData,xC(s));let a={format:t.format,generatedBy:t.generatedBy,convertedBy:t.convertedBy,signature:t.signature!=null?t.signature:void 0,userDefinedMetadata:t.userDefinedMetadata!=null?t.userDefinedMetadata:void 0,modelInitializer:t.modelInitializer!=null?t.modelInitializer:void 0,initializerSignature:t.initializerSignature!=null?t.initializerSignature:void 0,trainingConfig:t.trainingConfig!=null?t.trainingConfig:void 0};return this.LS.setItem(this.keys.modelMetadata,JSON.stringify(a)),{modelArtifactsInfo:n}}catch{throw EC(this.keys),new Error(`Failed to save model '${this.modelPath}' to local storage: size quota being exceeded is a possible cause of this failure: modelTopologyBytes=${n.modelTopologyBytes}, weightSpecsBytes=${n.weightSpecsBytes}, weightDataBytes=${n.weightDataBytes}.`)}}}async load(){let t=JSON.parse(this.LS.getItem(this.keys.info));if(t==null)throw new Error(`In local storage, there is no model with name '${this.modelPath}'`);if(t.modelTopologyType!=="JSON")throw new Error("BrowserLocalStorage does not support loading non-JSON model topology yet.");let e={},o=JSON.parse(this.LS.getItem(this.keys.topology));if(o==null)throw new Error(`In local storage, the topology of model '${this.modelPath}' is missing.`);e.modelTopology=o;let n=JSON.parse(this.LS.getItem(this.keys.weightSpecs));if(n==null)throw new Error(`In local storage, the weight specs of model '${this.modelPath}' are missing.`);e.weightSpecs=n;let s=this.LS.getItem(this.keys.modelMetadata);if(s!=null){let i=JSON.parse(s);e.format=i.format,e.generatedBy=i.generatedBy,e.convertedBy=i.convertedBy,i.signature!=null&&(e.signature=i.signature),i.userDefinedMetadata!=null&&(e.userDefinedMetadata=i.userDefinedMetadata),i.modelInitializer!=null&&(e.modelInitializer=i.modelInitializer),i.initializerSignature!=null&&(e.initializerSignature=i.initializerSignature),i.trainingConfig!=null&&(e.trainingConfig=i.trainingConfig)}let a=this.LS.getItem(this.keys.weightData);if(a==null)throw new Error(`In local storage, the binary weight values of model '${this.modelPath}' are missing.`);return e.weightData=yC(a),e}};Fo.URL_SCHEME="localstorage://";$C=r=>O().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(Fo.URL_SCHEME)?AU(r.slice(Fo.URL_SCHEME.length)):null;Ae.registerSaveRouter($C);Ae.registerLoadRouter($C);xm=class{constructor(){$(O().getBool("IS_BROWSER"),()=>"Current environment is not a web browser"),$(typeof window=="undefined"||typeof window.localStorage!="undefined",()=>"Current browser does not appear to support localStorage"),this.LS=window.localStorage}async listModels(){let t={},e=el+nn,o=nn+IC;for(let n=0;n<this.LS.length;++n){let s=this.LS.key(n);if(s.startsWith(e)&&s.endsWith(o)){let a=$U(s);t[a]=JSON.parse(this.LS.getItem(s))}}return t}async removeModel(t){t=RU(t);let e=kC(t);if(this.LS.getItem(e.info)==null)throw new Error(`Cannot find model at path '${t}'`);let o=JSON.parse(this.LS.getItem(e.info));return EC(e),o}}});function ym(r){if(r.indexOf(rl)===-1)throw new Error(`The url string provided does not contain a scheme. Supported schemes are: ${xo.getSchemes().join(",")}`);return{scheme:r.split(rl)[0],path:r.split(rl)[1]}}async function RC(r,t,e=!1){$(r!==t,()=>`Old path and new path are the same: '${r}'`);let o=Ae.getLoadHandlers(r);$(o.length>0,()=>`Copying failed because no load handler is found for source URL ${r}.`),$(o.length<2,()=>`Copying failed because more than one (${o.length}) load handlers for source URL ${r}.`);let n=o[0],s=Ae.getSaveHandlers(t);$(s.length>0,()=>`Copying failed because no save handler is found for destination URL ${t}.`),$(s.length<2,()=>`Copying failed because more than one (${o.length}) save handlers for destination URL ${t}.`);let a=s[0],i=ym(r).scheme,c=ym(r).path,l=i===ym(r).scheme,u=await n.load();e&&l&&await xo.getManager(i).removeModel(c);let p=await a.save(u);return e&&!l&&await xo.getManager(i).removeModel(c),p.modelArtifactsInfo}async function AC(){let r=xo.getSchemes(),t={};for(let e of r){let o=await xo.getManager(e).listModels();for(let n in o){let s=e+rl+n;t[s]=o[n]}}return t}async function _C(r){let t=ym(r);return xo.getManager(t.scheme).removeModel(t.path)}async function DC(r,t){return RC(r,t,!1)}async function FC(r,t){return RC(r,t,!0)}var rl,xo,Fx=h(()=>{X();ba();rl="://",xo=class r{constructor(){this.managers={}}static getInstance(){return r.instance==null&&(r.instance=new r),r.instance}static registerManager(t,e){$(t!=null,()=>"scheme must not be undefined or null."),t.endsWith(rl)&&(t=t.slice(0,t.indexOf(rl))),$(t.length>0,()=>"scheme must not be an empty string.");let o=r.getInstance();$(o.managers[t]==null,()=>`A model store manager is already registered for scheme '${t}'.`),o.managers[t]=e}static getManager(t){let e=r.getInstance().managers[t];if(e==null)throw new Error(`Cannot find model manager for scheme '${t}'`);return e}static getSchemes(){return Object.keys(r.getInstance().managers)}}});var Ox,OC=h(()=>{Jc();Ke();_x();Dx();Fx();nx();Ox=class{constructor(){this.messageName="setTimeoutCustom",this.functionRefs=[],this.handledMessageCount=0,this.hasEventListener=!1}fetch(t,e){return fetch(t,e)}now(){return performance.now()}encode(t,e){if(e!=="utf-8"&&e!=="utf8")throw new Error(`Browser's encoder only supports utf-8, but got ${e}`);return this.textEncoder==null&&(this.textEncoder=new TextEncoder),this.textEncoder.encode(t)}decode(t,e){return new TextDecoder(e).decode(t)}setTimeoutCustom(t,e){if(typeof window=="undefined"||!O().getBool("USE_SETTIMEOUTCUSTOM")){setTimeout(t,e);return}this.functionRefs.push(t),setTimeout(()=>{window.postMessage({name:this.messageName,index:this.functionRefs.length-1},"*")},e),this.hasEventListener||(this.hasEventListener=!0,window.addEventListener("message",o=>{if(o.source===window&&o.data.name===this.messageName){o.stopPropagation();let n=this.functionRefs[o.data.index];n(),this.handledMessageCount++,this.handledMessageCount===this.functionRefs.length&&(this.functionRefs=[],this.handledMessageCount=0)}},!0))}isTypedArray(t){return om(t)}};if(O().get("IS_BROWSER")){O().setPlatform("browser",new Ox);try{xo.registerManager(Fo.URL_SCHEME,new xm)}catch{}try{xo.registerManager(Do.URL_SCHEME,new gm)}catch{}}});var PC=Ur(()=>{});var LC=Ur(()=>{});var _U,Px,Lx,MC=h(()=>{Ke();_U={importFetch:()=>PC()},Lx=class{constructor(){this.util=LC(),this.textEncoder=new this.util.TextEncoder}fetch(t,e){return O().global.fetch!=null?O().global.fetch(t,e):(Px==null&&(Px=_U.importFetch()),Px(t,e))}now(){let t=process.hrtime();return t[0]*1e3+t[1]/1e6}encode(t,e){if(e!=="utf-8"&&e!=="utf8")throw new Error(`Node built-in encoder only supports utf-8, but got ${e}`);return this.textEncoder.encode(t)}decode(t,e){return t.length===0?"":new this.util.TextDecoder(e).decode(t)}isTypedArray(t){return this.util.types.isFloat32Array(t)||this.util.types.isInt32Array(t)||this.util.types.isUint8Array(t)||this.util.types.isUint8ClampedArray(t)}};O().get("IS_NODE")&&!O().get("IS_BROWSER")&&O().setPlatform("node",new Lx)});function ut(r,t="float32",e){return t=t||"float32",oe(r),new Bt(r,t,e)}var sn=h(()=>{Kr();X();});function DU(r,t){let e=C(r,"x","cast");if(!jg(t))throw new Error(`Failed to cast to unknown dtype ${t}`);if(t==="string"&&e.dtype!=="string"||t!=="string"&&e.dtype==="string")throw new Error("Only strings can be casted to strings");let o={x:e},n={dtype:t};return E.runKernel(En,o,n)}var _t,rr=h(()=>{B();H();P();X();F();_t=T({cast_:DU})});function FU(r){let e={x:C(r,"x","clone","string_or_numeric")};return E.runKernel($n,e)}var dr,ol=h(()=>{B();H();P();F();dr=T({clone_:FU})});function bm(r,t=!1){console.log(r.toString(t))}var Mx=h(()=>{});var OU,BC=h(()=>{B();Jc();OC();MC();sn();rr();ol();Mx();Kr();yx();OU={buffer:ut,cast:_t,clone:dr,print:bm};iC(OU)});function PU(r,t){let e=C(r,"a","add"),o=C(t,"b","add");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel("Add",n)}var mt,Ie=h(()=>{B();me();P();F();mt=T({add_:PU})});function LU(r,t){let e=C(r,"a","floorDiv"),o=C(t,"b","floorDiv");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel(Rs,n)}var vm,Bx=h(()=>{B();H();me();P();F();vm=T({floorDiv_:LU})});function MU(r,t){let e=C(r,"a","div"),o=C(t,"b","div");if([e,o]=kt(e,o),e.dtype==="int32"&&o.dtype==="int32")return vm(e,o);let n={a:e,b:o},s={};return E.runKernel(Is,n,s)}var Dt,hr=h(()=>{B();H();me();P();Bx();F();Dt=T({div_:MU})});function BU(r,t){let e=C(r,"a","mul"),o=C(t,"b","mul");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel(Us,n)}var tt,ae=h(()=>{B();H();me();P();F();tt=T({mul_:BU})});function VU(r){let t=C(r,"x","abs");if(t.dtype==="complex64"){let e={x:t};return E.runKernel(Si,e)}else{let e={x:t};return E.runKernel("Abs",e)}}var Be,wa=h(()=>{B();H();P();F();Be=T({abs_:VU})});function zU(r){let e={x:C(r,"x","acos")};return E.runKernel(hs,e)}var VC,zC=h(()=>{B();H();P();F();VC=T({acos_:zU})});function GU(r){let e={x:C(r,"x","acosh")};return E.runKernel(gs,e)}var GC,WC=h(()=>{B();H();P();F();GC=T({acosh_:GU})});function WU(r){$(Array.isArray(r),()=>"The argument passed to tf.addN() must be a list of tensors"),$(r.length>=1,()=>`Must pass at least one tensor to tf.addN(), but got ${r.length}`);let t=r.map((n,s)=>C(n,`tensors${s}`,"addN")),e=t[0];t.forEach(n=>{if(n.dtype!==e.dtype)throw new Error("All tensors passed to tf.addN() must have the same dtype")}),t.forEach(n=>{if(!Er(n.shape,e.shape))throw new Error("All tensors passed to tf.addN() must have the same shape")});let o=t;return E.runKernel(fi,o)}var UC,HC=h(()=>{B();H();P();X();F();UC=T({addN_:WU})});function UU(r,t=null,e=!1){let n={x:C(r,"x","all","bool")},s={axis:t,keepDims:e};return E.runKernel("All",n,s)}var KC,qC=h(()=>{B();P();F();KC=T({all_:UU})});function HU(r,t=null,e=!1){let n={x:C(r,"x","any","bool")},s={axis:t,keepDims:e};return E.runKernel("Any",n,s)}var XC,jC=h(()=>{B();P();F();XC=T({any_:HU})});function KU(r,t=0){let o={x:C(r,"x","argMax")},n={axis:t};return E.runKernel(di,o,n)}var YC,ZC=h(()=>{B();H();P();F();YC=T({argMax_:KU})});function qU(r,t=0){let o={x:C(r,"x","argMin")},n={axis:t};return E.runKernel(hi,o,n)}var QC,JC=h(()=>{B();H();P();F();QC=T({argMin_:qU})});function XU(r){let e={x:C(r,"x","asin")};return E.runKernel(xs,e)}var tS,eS=h(()=>{B();H();P();F();tS=T({asin_:XU})});function jU(r){let e={x:C(r,"x","asinh")};return E.runKernel(ys,e)}var rS,oS=h(()=>{B();H();P();F();rS=T({asinh_:jU})});function YU(r){let e={x:C(r,"x","atan")};return E.runKernel(bs,e)}var nS,sS=h(()=>{B();H();P();F();nS=T({atan_:YU})});function ZU(r,t){let e=C(r,"a","atan2"),o=C(t,"b","atan2");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel(ws,n)}var aS,iS=h(()=>{B();H();me();P();F();aS=T({atan2_:ZU})});function QU(r){let e={x:C(r,"x","atanh")};return E.runKernel(vs,e)}var cS,lS=h(()=>{B();H();P();F();cS=T({atanh_:QU})});function JU(r,t,e,o,n="NHWC",s){let a=r[3],i=[...t,a],c=pS(n);return Sa(r,i,e,s,o,null,null,c)}function zx(r,t,e,o,n,s,a="channelsLast"){let[i,c]=du(t),l;if(a==="channelsLast")l=[i,c,r[3],r[3]];else if(a==="channelsFirst")l=[i,c,r[1],r[1]];else throw new Error(`Unknown dataFormat ${a}`);return Sa(r,l,e,o,n,s,!1,a)}function tH(r,t,e,o,n,s,a="NDHWC"){let[i,c,l]=Vx(t),u,p;if(a==="NDHWC")p="channelsLast",u=[i,c,l,r[4],r[4]];else if(a==="NCDHW")p="channelsFirst",u=[i,c,l,r[1],r[1]];else throw new Error(`Unknown dataFormat ${a}`);return uS(r,u,e,o,n,!1,p,s)}function Sa(r,t,e,o,n,s,a=!1,i="channelsLast"){let[c,l,u,p]=[-1,-1,-1,-1];if(i==="channelsLast")[c,l,u,p]=r;else if(i==="channelsFirst")[c,p,l,u]=r;else throw new Error(`Unknown dataFormat ${i}`);let[m,f,,d]=t,[x,g]=du(e),[y,v]=du(o),N=nl(m,y),S=nl(f,v),{padInfo:R,outHeight:A,outWidth:_}=oH(n,l,u,x,g,N,S,s,i),D=a?d*p:d,L;return i==="channelsFirst"?L=[c,D,A,_]:i==="channelsLast"&&(L=[c,A,_,D]),{batchSize:c,dataFormat:i,inHeight:l,inWidth:u,inChannels:p,outHeight:A,outWidth:_,outChannels:D,padInfo:R,strideHeight:x,strideWidth:g,filterHeight:m,filterWidth:f,effectiveFilterHeight:N,effectiveFilterWidth:S,dilationHeight:y,dilationWidth:v,inShape:r,outShape:L,filterShape:t}}function uS(r,t,e,o,n,s=!1,a="channelsLast",i){let[c,l,u,p,m]=[-1,-1,-1,-1,-1];if(a==="channelsLast")[c,l,u,p,m]=r;else if(a==="channelsFirst")[c,m,l,u,p]=r;else throw new Error(`Unknown dataFormat ${a}`);let[f,d,x,,g]=t,[y,v,N]=Vx(e),[S,R,A]=Vx(o),_=nl(f,S),D=nl(d,R),L=nl(x,A),{padInfo:M,outDepth:V,outHeight:W,outWidth:G}=nH(n,l,u,p,y,v,N,_,D,L,i),K=s?g*m:g,U;return a==="channelsFirst"?U=[c,K,V,W,G]:a==="channelsLast"&&(U=[c,V,W,G,K]),{batchSize:c,dataFormat:a,inDepth:l,inHeight:u,inWidth:p,inChannels:m,outDepth:V,outHeight:W,outWidth:G,outChannels:K,padInfo:M,strideDepth:y,strideHeight:v,strideWidth:N,filterDepth:f,filterHeight:d,filterWidth:x,effectiveFilterDepth:_,effectiveFilterHeight:D,effectiveFilterWidth:L,dilationDepth:S,dilationHeight:R,dilationWidth:A,inShape:r,outShape:U,filterShape:t}}function eH(r,t,e,o,n){o==null&&(o=Gx(r,t,e));let s=r[0],a=r[1],i=hu((s-t+2*o)/e+1,n),c=hu((a-t+2*o)/e+1,n);return[i,c]}function rH(r,t,e,o,n,s){n==null&&(n=Gx(r,t[0],o[0]));let a=[0,0,0,e];for(let i=0;i<3;i++)r[i]+2*n>=t[i]&&(a[i]=hu((r[i]-t[i]+2*n)/o[i]+1,s));return a}function Gx(r,t,e,o=1){let n=nl(t,o);return Math.floor((r[0]*(e-1)-e+n)/2)}function du(r){return typeof r=="number"?[r,r,r]:r.length===2?[r[0],r[1],1]:r}function Vx(r){return typeof r=="number"?[r,r,r]:r}function nl(r,t){return t<=1?r:r+(r-1)*(t-1)}function oH(r,t,e,o,n,s,a,i,c){let l,u,p;if(typeof r=="number"){l={top:r,bottom:r,left:r,right:r,type:r===0?"VALID":"NUMBER"};let f=eH([t,e],s,o,r,i);u=f[0],p=f[1]}else if(r==="same"){u=Math.ceil(t/o),p=Math.ceil(e/n);let m=Math.max(0,(u-1)*o+s-t),f=Math.max(0,(p-1)*n+a-e),d=Math.floor(m/2),x=m-d,g=Math.floor(f/2),y=f-g;l={top:d,bottom:x,left:g,right:y,type:"SAME"}}else if(r==="valid")l={top:0,bottom:0,left:0,right:0,type:"VALID"},u=Math.ceil((t-s+1)/o),p=Math.ceil((e-a+1)/n);else if(typeof r=="object"){let m=c==="channelsLast"?r[1][0]:r[2][0],f=c==="channelsLast"?r[1][1]:r[2][1],d=c==="channelsLast"?r[2][0]:r[3][0],x=c==="channelsLast"?r[2][1]:r[3][1];l={top:m,bottom:f,left:d,right:x,type:m===0&&f===0&&d===0&&x===0?"VALID":"EXPLICIT"},u=hu((t-s+m+f)/o+1,i),p=hu((e-a+d+x)/n+1,i)}else throw Error(`Unknown padding parameter: ${r}`);return{padInfo:l,outHeight:u,outWidth:p}}function nH(r,t,e,o,n,s,a,i,c,l,u){let p,m,f,d;if(r==="valid"&&(r=0),typeof r=="number"){p={top:r,bottom:r,left:r,right:r,front:r,back:r,type:r===0?"VALID":"NUMBER"};let g=rH([t,e,o,1],[i,c,l],1,[n,s,a],r,u);m=g[0],f=g[1],d=g[2]}else if(r==="same"){m=Math.ceil(t/n),f=Math.ceil(e/s),d=Math.ceil(o/a);let x=(m-1)*n+i-t,g=(f-1)*s+c-e,y=(d-1)*a+l-o,v=Math.floor(x/2),N=x-v,S=Math.floor(g/2),R=g-S,A=Math.floor(y/2),_=y-A;p={top:S,bottom:R,left:A,right:_,front:v,back:N,type:"SAME"}}else throw Error(`Unknown padding parameter: ${r}`);return{padInfo:p,outDepth:m,outHeight:f,outWidth:d}}function hu(r,t){if(!t)return Math.trunc(r);switch(t){case"round":return Math.round(r);case"ceil":return Math.ceil(r);case"floor":return Math.floor(r);default:throw new Error(`Unknown roundingMode ${t}`)}}function Ca(r){let[t,e,o]=du(r);return t===1&&e===1&&o===1}function or(r,t){return Ca(r)||Ca(t)}function Oo(r){return du(r).every(t=>t>0)}function pS(r){if(r==="NHWC")return"channelsLast";if(r==="NCHW")return"channelsFirst";throw new Error(`Unknown dataFormat ${r}`)}function ve(r,t,e){if(e!=null){if(typeof t=="string")throw Error(`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);if(typeof t=="number")$(Jo(t),()=>`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);else if(typeof t=="object")t.forEach(o=>{o.forEach(n=>{$(Jo(n),()=>`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${n}.`)})});else throw Error(`Error in ${r}: Unknown padding parameter: ${t}`)}}var gr=h(()=>{X();});function sH(r,t){let o={x:C(r,"x","reshape","string_or_numeric")},n={shape:t};return E.runKernel(xc,o,n)}var z,Et=h(()=>{B();H();P();F();z=T({reshape_:sH})});function aH(r,t,e,o,n){let s=C(r,"x","avgPool","float32"),a=1;$(or(e,a),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${a}'`);let i=s,c=!1;s.rank===3&&(c=!0,i=z(s,[1,s.shape[0],s.shape[1],s.shape[2]])),$(i.rank===4,()=>`Error in avgPool: x must be rank 4 but got rank ${i.rank}.`),ve("avgPool",o,n);let l={x:i},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n},p=E.runKernel(gi,l,u);return p=_t(p,s.dtype),c?z(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var Sm,Wx=h(()=>{B();H();P();X();rr();gr();F();Et();Sm=T({avgPool_:aH})});function iH(r,t,e,o,n,s="NDHWC"){let a=C(r,"x","avgPool3d","float32"),i=a,c=!1;a.rank===4&&(c=!0,i=z(a,[1,a.shape[0],a.shape[1],a.shape[2],a.shape[3]])),$(i.rank===5,()=>`Error in avgPool3d: x must be rank 5 but got rank ${i.rank}.`),$(s==="NDHWC",()=>`Error in avgPool3d: Only NDHWC is currently supported, but got dataFormat of ${s}`),$(typeof e=="number"&&e>0||Array.isArray(e)&&e[0]>0&&e[1]>0&&e[2]>0,()=>`Error in avgPool3d: Stride must be > 0, but got '${e}'`),ve("avgPool3d",o,n);let l={x:i},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n,dataFormat:s},p=E.runKernel(xi,l,u);return p=_t(p,i.dtype),c?z(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}var mS,fS=h(()=>{B();H();P();X();rr();gr();F();Et();mS=T({avgPool3d_:iH})});function cH(r,t=0){$(r.length>=1,()=>"Pass at least one tensor to concat");let e=xa(r,"tensors","concat","string_or_numeric");if(e[0].dtype==="complex64"&&e.forEach(s=>{if(s.dtype!=="complex64")throw new Error(`Cannot concatenate complex64 tensors with a tensor
          with dtype ${s.dtype}. `)}),e.length===1)return dr(e[0]);let o=e,n={axis:t};return E.runKernel(Ni,o,n)}var Jt,yo=h(()=>{B();H();P();X();ol();F();Jt=T({concat_:cH})});function lH(r,t,e=!1,o=!1){let n=C(r,"a","matMul"),s=C(t,"b","matMul");[n,s]=kt(n,s);let a={a:n,b:s},i={transposeA:e,transposeB:o};return E.runKernel(yi,a,i)}var zt,Vn=h(()=>{B();H();me();P();F();zt=T({matMul_:lH})});function uH(r){let e={x:C(r,"x","sigmoid","float32")};return E.runKernel(ta,e)}var bo,gu=h(()=>{B();H();P();F();bo=T({sigmoid_:uH})});function pH(r,t,e){let o=C(r,"x","slice","string_or_numeric");if(o.rank===0)throw new Error("Slicing scalar is not possible");let n={x:o},s={begin:t,size:e};return E.runKernel(Tc,n,s)}var Ft,oo=h(()=>{B();H();P();F();Ft=T({slice_:pH})});function mH(r){let e={x:C(r,"x","tanh","float32")};return E.runKernel(sa,e)}var xu,Ux=h(()=>{B();H();P();F();xu=T({tanh_:mH})});function fH(r,t,e,o,n,s){let a=C(r,"forgetBias","basicLSTMCell"),i=C(t,"lstmKernel","basicLSTMCell"),c=C(e,"lstmBias","basicLSTMCell"),l=C(o,"data","basicLSTMCell"),u=C(n,"c","basicLSTMCell"),p=C(s,"h","basicLSTMCell"),m=Jt([l,p],1),f=zt(m,i),d=mt(f,c),x=d.shape[0],g=d.shape[1]/4,y=[x,g],v=Ft(d,[0,0],y),N=Ft(d,[0,g],y),S=Ft(d,[0,g*2],y),R=Ft(d,[0,g*3],y),A=mt(tt(bo(v),xu(N)),tt(u,bo(mt(a,S)))),_=tt(xu(A),bo(R));return[A,_]}var dS,hS=h(()=>{P();Ie();yo();Vn();ae();F();gu();oo();Ux();dS=T({basicLSTMCell_:fH})});function dH(r,t,e){let o=C(r,"x","batchToSpaceND"),n=t.reduce((i,c)=>i*c);$(o.rank>=1+t.length,()=>`input rank is ${o.rank} but should be > than blockShape.length ${t.length}`),$(e.length===t.length,()=>`crops.length is ${e.length} but should be equal to blockShape.length  ${t.length}`),$(o.shape[0]%n===0,()=>`input tensor batch is ${o.shape[0]} but is not divisible by the product of the elements of blockShape ${t.join(" * ")} === ${n}`);let s={x:o},a={blockShape:t,crops:e};return E.runKernel(bi,s,a)}var Nm,Hx=h(()=>{B();H();P();X();F();Nm=T({batchToSpaceND_:dH})});function gS(r){let t;return r.rank===0||r.rank===1?t=z(r,[1,1,1,r.size]):r.rank===2?t=z(r,[1,1,r.shape[0],r.shape[1]]):r.rank===3?t=z(r,[1,r.shape[0],r.shape[1],r.shape[2]]):t=r,t}var xS=h(()=>{Et()});function hH(r,t,e,o,n,s){s==null&&(s=.001);let a=C(r,"x","batchNorm"),i=C(t,"mean","batchNorm"),c=C(e,"variance","batchNorm"),l;n!=null&&(l=C(n,"scale","batchNorm"));let u;o!=null&&(u=C(o,"offset","batchNorm")),$(i.rank===c.rank,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),$(u==null||i.rank===u.rank,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),$(l==null||i.rank===l.rank,()=>"Batch normalization gradient requires mean and scale to have equal ranks.");let m={x:gS(a),scale:l,offset:u,mean:i,variance:c},f={varianceEpsilon:s},d=E.runKernel(Ui,m,f);return z(d,a.shape)}var zn,yu=h(()=>{B();H();P();X();xS();F();Et();zn=T({batchNorm_:hH})});function gH(r,t,e,o,n,s){let a=C(r,"x","batchNorm"),i=C(t,"mean","batchNorm"),c=C(e,"variance","batchNorm"),l;n!=null&&(l=C(n,"scale","batchNorm"));let u;return o!=null&&(u=C(o,"offset","batchNorm")),$(a.rank===2,()=>`Error in batchNorm2D: x must be rank 2 but got rank ${a.rank}.`),$(i.rank===2||i.rank===1,()=>`Error in batchNorm2D: mean must be rank 2 or rank 1 but got rank ${i.rank}.`),$(c.rank===2||c.rank===1,()=>`Error in batchNorm2D: variance must be rank 2 or rank 1 but got rank ${c.rank}.`),l!=null&&$(l.rank===2||l.rank===1,()=>`Error in batchNorm2D: scale must be rank 2 or rank 1 but got rank ${l.rank}.`),u!=null&&$(u.rank===2||u.rank===1,()=>`Error in batchNorm2D: offset must be rank 2 or rank 1 but got rank ${u.rank}.`),zn(a,i,c,u,l,s)}var yS,bS=h(()=>{P();X();yu();F();yS=T({batchNorm2d_:gH})});function xH(r,t,e,o,n,s){let a=C(r,"x","batchNorm"),i=C(t,"mean","batchNorm"),c=C(e,"variance","batchNorm"),l;n!=null&&(l=C(n,"scale","batchNorm"));let u;return o!=null&&(u=C(o,"offset","batchNorm")),$(a.rank===3,()=>`Error in batchNorm3D: x must be rank 3 but got rank ${a.rank}.`),$(i.rank===3||i.rank===1,()=>`Error in batchNorm3D: mean must be rank 3 or rank 1 but got rank ${i.rank}.`),$(c.rank===3||c.rank===1,()=>`Error in batchNorm3D: variance must be rank 3 or rank 1 but got rank ${c.rank}.`),l!=null&&$(l.rank===3||l.rank===1,()=>`Error in batchNorm3D: scale must be rank 3 or rank 1 but got rank ${l.rank}.`),u!=null&&$(u.rank===3||u.rank===1,()=>`Error in batchNorm3D: offset must be rank 3 or rank 1 but got rank ${u.rank}.`),zn(a,i,c,u,l,s)}var vS,wS=h(()=>{P();X();yu();F();vS=T({batchNorm3d_:xH})});function yH(r,t,e,o,n,s){let a=C(r,"x","batchNorm"),i=C(t,"mean","batchNorm"),c=C(e,"variance","batchNorm"),l;n!=null&&(l=C(n,"scale","batchNorm"));let u;return o!=null&&(u=C(o,"offset","batchNorm")),$(a.rank===4,()=>`Error in batchNorm4D: x must be rank 4 but got rank ${a.rank}.`),$(i.rank===4||i.rank===1,()=>`Error in batchNorm4D: mean must be rank 4 or rank 1 but got rank ${i.rank}.`),$(c.rank===4||c.rank===1,()=>`Error in batchNorm4D: variance must be rank 4 or rank 1 but got rank ${c.rank}.`),l!=null&&$(l.rank===4||l.rank===1,()=>`Error in batchNorm4D: scale must be rank 4 or rank 1 but got rank ${l.rank}.`),u!=null&&$(u.rank===4||u.rank===1,()=>`Error in batchNorm4D: offset must be rank 4 or rank 1 but got rank ${u.rank}.`),zn(a,i,c,u,l,s)}var CS,SS=h(()=>{P();X();yu();F();CS=T({batchNorm4d_:yH})});function bH(r,t,e){let o=C(r,"x","bincount"),n=C(t,"weights","bincount");$(o.dtype==="int32",()=>`Error in bincount: input dtype must be int32, but got ${o.dtype}`),$(e>=0,()=>`size must be non-negative, but got ${e}.`),$(n.size===o.size||n.size===0,()=>`Error in bincount: weights must have the same size as input or0-length, but got input shape: ${o.shape}, weights shape: ${n.shape}.`);let s={x:o,weights:n},a={size:e};return E.runKernel(vi,s,a)}var Tm,Kx=h(()=>{B();H();P();X();F();Tm=T({bincount_:bH})});function vH(r,t){let e=C(r,"x","bitwiseAnd"),o=C(t,"y","bitwiseAnd");if(!Er(e.shape,o.shape))throw new Error(`BitwiseAnd: Tensors must have the same shape. x: ${e.shape}, y: ${o.shape}`);if(e.dtype!=="int32"||o.dtype!=="int32")throw new Error(`BitwiseAnd: Only supports 'int32' values in tensor, found type of x: ${e.dtype} and type of y: ${o.dtype}`);let n={a:e,b:o};return E.runKernel(Cs,n)}var NS,TS=h(()=>{B();H();P();Re();F();NS=T({bitwiseAnd_:vH})});function wH(r,t){let e=C(r,"s0","broadcastArgs","int32"),o=C(t,"s1","broadcastArgs","int32");if(e.rank!==1)throw new Error(`broadcastArgs(): first input must be a vector (rank=1). Has rank ${e.rank}`);if(o.rank!==1)throw new Error(`broadcastArgs(): second input must be a vector (rank=1). Has rank ${o.rank}`);let n={s0:e,s1:o};return E.runKernel(wi,n)}var IS,kS=h(()=>{B();H();P();F();IS=T({broadcastArgs_:wH})});function CH(r,t){let e=C(r,"broadcastTo","x"),o=e.shape;if(oe(t),t.length<e.rank)throw new Error(`broadcastTo(): shape.length=${t.length} < input.rank=${e.rank}.`);if(t.length>e.rank){let l=e.shape.slice();for(;l.length<t.length;)l.unshift(1);e=z(e,l)}let n=e.shape,s=Array.from(t);for(let l=t.length-1;l>=0;l--)if(n[l]===t[l])s[l]=1;else if(e.shape[l]!==1)throw new Error(`broadcastTo(): [${o}] cannot be broadcast to [${t}].`);if(s.map((l,u)=>l>1?u:-1).filter(l=>l>=0).length===0)return dr(e);let i={x:e},c={reps:s};return E.runKernel(Rn,i,c)}var Gn,qx=h(()=>{B();H();P();Re();ol();F();Et();Gn=T({broadcastTo_:CH})});function SH(r){let e={x:C(r,"x","ceil","float32")};return E.runKernel(Ss,e)}var ES,$S=h(()=>{B();H();P();F();ES=T({ceil_:SH})});function Lo(r,t,e){oe(r),e=e||kn(t);let o={shape:r,value:t,dtype:e};return E.runKernel(Gi,{},o)}var sl=h(()=>{B();H();X();Re();});function NH(r,t,e){let o=C(r,"x","clipByValue");if($(t<=e,()=>`Error in clip: min (${t}) must be less than or equal to max (${e}).`),t===e)return Lo(o.shape,t,o.dtype);let n={x:o},s={clipValueMin:t,clipValueMax:e};return E.runKernel(Ns,n,s)}var RS,AS=h(()=>{B();H();P();X();sl();F();RS=T({clipByValue_:NH})});function TH(r){return Jt(r,0)}var _S,DS=h(()=>{yo();F();_S=T({concat1d_:TH})});function IH(r,t){return Jt(r,t)}var FS,OS=h(()=>{yo();F();FS=T({concat2d_:IH})});function kH(r,t){return Jt(r,t)}var PS,LS=h(()=>{yo();F();PS=T({concat3d_:kH})});function EH(r,t){return Jt(r,t)}var MS,BS=h(()=>{yo();F();MS=T({concat4d_:EH})});function $H(r,t,e,o,n="NHWC",s=[1,1],a){let i=C(r,"x","conv2d","float32"),c=C(t,"filter","conv2d","float32"),l=i,u=!1;i.rank===3&&(u=!0,l=z(i,[1,i.shape[0],i.shape[1],i.shape[2]])),$(l.rank===4,()=>`Error in conv2d: input must be rank 4, but got rank ${l.rank}.`),$(c.rank===4,()=>`Error in conv2d: filter must be rank 4, but got rank ${c.rank}.`),ve("conv2d",o,a);let p=n==="NHWC"?l.shape[3]:l.shape[1];$(p===c.shape[2],()=>`Error in conv2d: depth of input (${p}) must match input depth for filter ${c.shape[2]}.`),$(or(e,s),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),$(Oo(s),()=>"Error in conv2D: Dilated rates should be larger than 0."),$(Oo(e),()=>"Error in conv2D: Strides should be larger than 0.");let m={x:l,filter:c},f={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:a},d=E.runKernel(Ti,m,f);return u?z(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var Wn,bu=h(()=>{B();H();P();X();gr();F();Et();Wn=T({conv2d_:$H})});function RH(r,t,e,o,n="NWC",s=1,a){let i=C(r,"x","conv1d"),c=C(t,"filter","conv1d"),l=i,u=!1;i.rank===2&&(u=!0,l=z(i,[1,i.shape[0],i.shape[1]])),$(l.rank===3,()=>`Error in conv1d: input must be rank 3, but got rank ${l.rank}.`),$(c.rank===3,()=>`Error in conv1d: filter must be rank 3, but got rank ${c.rank}.`),ve("conv1d",o,a),$(l.shape[2]===c.shape[1],()=>`Error in conv1d: depth of input (${l.shape[2]}) must match input depth for filter ${c.shape[1]}.`),$(or(e,s),()=>`Error in conv1D: Either stride or dilation must be 1. Got stride ${e} and dilation '${s}'`),$(Oo(s),()=>"Error in conv1D: Dilated rates should be larger than 0."),$(Oo(e),()=>"Error in conv1D: Stride should be larger than 0."),$(n==="NWC",()=>`Error in conv1d: got dataFormat of ${n} but only NWC is currently supported.`);let p=z(c,[1,c.shape[0],c.shape[1],c.shape[2]]),m=z(l,[l.shape[0],1,l.shape[1],l.shape[2]]),g=Wn(m,p,[1,e],o,"NHWC",[1,s],a);return u?z(g,[g.shape[2],g.shape[3]]):z(g,[g.shape[0],g.shape[2],g.shape[3]])}var VS,zS=h(()=>{P();X();bu();gr();F();Et();VS=T({conv1d_:RH})});function AH(r,t,e,o,n,s="NHWC",a){$(r.length===t.rank,()=>`Length of inShape (${r.length}) and rank of dy (${t.rank}) must match`);let i=r,c=t,l=!1;t.rank===3&&(l=!0,c=z(t,[1,t.shape[0],t.shape[1],t.shape[2]]),i=[1,r[0],r[1],r[2]]),$(i.length===4,()=>`Error in conv2dDerInput: inShape must be length 4, but got length ${i.length}.`),$(c.rank===4,()=>`Error in conv2dDerInput: dy must be rank 4, but got rank ${c.rank}`),$(e.rank===4,()=>`Error in conv2dDerInput: filter must be rank 4, but got rank ${e.rank}`);let u=s==="NHWC"?i[3]:i[1],p=s==="NHWC"?c.shape[3]:c.shape[1];$(u===e.shape[2],()=>`Error in conv2dDerInput: depth of input (${u}) must match input depth for filter ${e.shape[2]}.`),$(p===e.shape[3],()=>`Error in conv2dDerInput: depth of output (${p}) must match output depth for filter ${e.shape[3]}.`),ve("conv2dDerInput",n,a);let m={dy:c,filter:e},f={strides:o,pad:n,dataFormat:s,dimRoundingMode:a,inputShape:i},d=E.runKernel(ki,m,f);return l?z(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var Im,Xx=h(()=>{B();H();X();gr();F();Et();Im=T({conv2DBackpropInput_:AH})});function _H(r,t,e,o,n,s){let a=C(r,"x","conv2dTranspose"),i=C(t,"filter","conv2dTranspose");return Im(e,a,i,o,n,"NHWC",s)}var GS,WS=h(()=>{P();Xx();F();GS=T({conv2dTranspose_:_H})});function DH(r,t,e,o,n="NDHWC",s=[1,1,1]){let a=C(r,"x","conv3d"),i=C(t,"filter","conv3d"),c=a,l=!1;a.rank===4&&(l=!0,c=z(a,[1,a.shape[0],a.shape[1],a.shape[2],a.shape[3]])),$(c.rank===5,()=>`Error in conv3d: input must be rank 5, but got rank ${c.rank}.`),$(i.rank===5,()=>`Error in conv3d: filter must be rank 5, but got rank ${i.rank}.`),$(c.shape[4]===i.shape[3],()=>`Error in conv3d: depth of input (${c.shape[4]}) must match input depth for filter ${i.shape[3]}.`),$(or(e,s),()=>`Error in conv3D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),$(n==="NDHWC",()=>`Error in conv3d: got dataFormat of ${n} but only NDHWC is currently supported.`),$(Oo(s),()=>"Error in conv3D: Dilated rates should be larger than 0."),$(Oo(e),()=>"Error in conv3D: Strides should be larger than 0.");let u={x:c,filter:i},p={strides:e,pad:o,dataFormat:n,dilations:s},m=E.runKernel(Ei,u,p);return l?z(m,[m.shape[1],m.shape[2],m.shape[3],m.shape[4]]):m}var US,HS=h(()=>{B();H();P();X();gr();F();Et();US=T({conv3d_:DH})});function FH(r,t,e,o,n){$(r.length===t.rank,()=>`Length of inShape (${r.length}) and rank of dy (${t.rank}) must match`);let s=r,a=t,i=!1;t.rank===4&&(i=!0,a=z(t,[1,t.shape[0],t.shape[1],t.shape[2],t.shape[3]]),s=[1,r[0],r[1],r[2],r[3]]);let c=s[4],l=a.shape[4];$(s.length===5,()=>`Error in conv3dDerInput: inShape must be length 5, but got length ${s.length}.`),$(a.rank===5,()=>`Error in conv3dDerInput: dy must be rank 5, but got rank ${a.rank}`),$(e.rank===5,()=>`Error in conv3dDerInput: filter must be rank 5, but got rank ${e.rank}`),$(c===e.shape[3],()=>`Error in conv3dDerInput: depth of input (${c}) must match input depth for filter ${e.shape[3]}.`),$(l===e.shape[4],()=>`Error in conv3dDerInput: depth of output (${l}) must match output depth for filter ${e.shape[4]}.`);let u={dy:a,filter:e},p={pad:n,strides:o,inputShape:s},m=E.runKernel($i,u,p);return i?z(m,[m.shape[1],m.shape[2],m.shape[3],m.shape[4]]):m}var KS,qS=h(()=>{B();H();X();F();Et();KS=T({conv3DBackpropInput_:FH})});function OH(r,t,e,o,n){let s=C(r,"x","conv3dTranspose"),a=C(t,"filter","conv3dTranspose");return KS(e,s,a,o,n)}var XS,jS=h(()=>{P();qS();F();XS=T({conv3dTranspose_:OH})});function PH(r){let e={x:C(r,"x","cos","float32")};return E.runKernel("Cos",e)}var YS,ZS=h(()=>{B();P();F();YS=T({cos_:PH})});function LH(r){let e={x:C(r,"x","cosh","float32")};return E.runKernel(Ts,e)}var QS,JS=h(()=>{B();H();P();F();QS=T({cosh_:LH})});function MH(r,t=0,e=!1,o=!1){let s={x:C(r,"x","cumprod")},a={axis:t,exclusive:e,reverse:o};return E.runKernel(Ri,s,a)}var tN,eN=h(()=>{B();H();P();F();tN=T({cumprod_:MH})});function BH(r,t=0,e=!1,o=!1){let s={x:C(r,"x","cumsum")},a={axis:t,exclusive:e,reverse:o};return E.runKernel(Ai,s,a)}var rN,oN=h(()=>{B();H();P();F();rN=T({cumsum_:BH})});function VH(r,t,e,o=!1){let n=C(r,"x","denseBincount"),s=C(t,"weights","denseBincount");$(n.dtype==="int32",()=>`Error in denseBincount: input dtype must be int32, but got ${n.dtype}`),$(n.rank<=2,()=>`Error in denseBincount: input must be at most rank 2, but got rank ${n.rank}.`),$(e>=0,()=>`size must be non-negative, but got ${e}.`),$(s.size===n.size||s.size===0,()=>`Error in denseBincount: weights must have the same shape as x or 0-length, but got x shape: ${n.shape}, weights shape: ${s.shape}.`);let a={x:n,weights:s},i={size:e,binaryOutput:o};return E.runKernel(Di,a,i)}var nN,sN=h(()=>{B();H();P();X();F();nN=T({denseBincount_:VH})});function zH(r,t,e="NHWC"){let o=C(r,"x","depthToSpace","float32"),n=e==="NHWC"?o.shape[1]:o.shape[2],s=e==="NHWC"?o.shape[2]:o.shape[3],a=e==="NHWC"?o.shape[3]:o.shape[1];$(t>1,()=>`blockSize should be > 1 for depthToSpace, but was: ${t}`),$(n*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${n} and ${t}  for depthToSpace with input shape
    ${o.shape}`),$(s*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${s} and ${t} for depthToSpace with input shape
        ${o.shape}`),$(a%(t*t)===0,()=>`Dimension size must be evenly divisible by ${t*t} but is ${a} for depthToSpace with input shape ${o.shape}`);let i={x:o},c={blockSize:t,dataFormat:e};return E.runKernel(Fi,i,c)}var aN,iN=h(()=>{B();H();P();X();F();aN=T({depthToSpace_:zH})});function GH(r,t,e,o,n="NHWC",s=[1,1],a){let i=C(r,"x","depthwiseConv2d","float32"),c=C(t,"filter","depthwiseConv2d","float32"),l=i,u=!1;i.rank===3&&(u=!0,l=z(i,[1,i.shape[0],i.shape[1],i.shape[2]])),$(l.rank===4,()=>`Error in depthwiseConv2d: input must be rank 4, but got rank ${l.rank}.`),$(c.rank===4,()=>`Error in depthwiseConv2d: filter must be rank 4, but got rank ${c.rank}.`);let p=n==="NHWC"?l.shape[3]:l.shape[1];$(p===c.shape[2],()=>`Error in depthwiseConv2d: number of input channels (${p}) must match the inChannels dimension in filter ${c.shape[2]}.`),ve("depthwiseConv2d",o,a);let m={x:l,filter:c},f={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:a},d=E.runKernel(Oi,m,f);return u?z(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var al,km=h(()=>{B();H();P();X();gr();F();Et();al=T({depthwiseConv2d_:GH})});function WH(r){let e={x:C(r,"x","diag")};return E.runKernel(Mi,e)}var cN,lN=h(()=>{B();H();P();F();cN=T({diag_:WH})});function UH(r,t,e,o,n=[1,1],s="NHWC"){let a=C(r,"x","dilation2d"),i=C(t,"filter","dilation2d");$(a.rank===3||a.rank===4,()=>`Error in dilation2d: input must be rank 3 or 4, but got rank ${a.rank}.`),$(i.rank===3,()=>`Error in dilation2d: filter must be rank 3, but got rank ${i.rank}.`),$(s==="NHWC",()=>`Error in dilation2d: Only NHWC is currently supported, but got dataFormat of ${s}`);let c=a,l=!1;a.rank===3&&(c=z(a,[1,a.shape[0],a.shape[1],a.shape[2]]),l=!0),$(c.shape[3]===i.shape[2],()=>`Error in dilation2d:  input and filter must have the same depth: ${c.shape[3]} vs ${i.shape[2]}`);let u={x:c,filter:i},p={strides:e,pad:o,dilations:n},m=E.runKernel(Bi,u,p);return l?z(m,[m.shape[1],m.shape[2],m.shape[3]]):m}var uN,pN=h(()=>{B();H();P();X();F();Et();uN=T({dilation2d_:UH})});var Mo={};Yt(Mo,{assertAndGetBroadcastShape:()=>Vt,getBroadcastDims:()=>mN,getReductionAxes:()=>Em});function mN(r,t){let e=r.length,o=[];for(let n=0;n<e;n++){let s=e-1-n,a=r[s]||1;(t[t.length-1-n]||1)>1&&a===1&&o.unshift(s)}return o}function Em(r,t){let e=[];for(let o=0;o<t.length;o++){let n=r[r.length-o-1],s=t.length-o-1,a=t[s];(n==null||n===1&&a>1)&&e.unshift(s)}return e}function Vt(r,t){let e=Math.max(r.length,t.length),o=new Array(e);for(let n=0;n<e;n++){let s=r[r.length-n-1];s==null&&(s=1);let a=t[t.length-n-1];if(a==null&&(a=1),s===1)o[e-n-1]=a;else if(a===1)o[e-n-1]=s;else if(s!==a){let i=`Operands could not be broadcast together with shapes ${r} and ${t}.`;throw Error(i)}else o[e-n-1]=s}return o}var _e=h(()=>{});function HH(r,t){let e=C(r,"a","equal","string_or_numeric"),o=C(t,"b","equal","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(ks,n)}var $m,jx=h(()=>{B();H();me();P();_e();F();$m=T({equal_:HH})});function KH(r,t,e){let o=C(t,"a","where"),n=C(e,"b","where"),s=C(r,"condition","where","bool"),a=Vt(Vt(s.shape,o.shape),n.shape),i=Gn(s,a),c=Gn(o,a),l=Gn(n,a),u={condition:i,t:c,e:l};return E.runKernel(Nc,u)}var qr,il=h(()=>{B();H();P();qx();_e();F();qr=T({where_:KH})});function qH(r){let e={x:C(r,"x","zerosLike")};return E.runKernel(Wc,e)}var ke,an=h(()=>{B();H();P();F();ke=T({zerosLike_:qH})});function XH(r,t){let e=C(r,"a","div"),o=C(t,"b","div");[e,o]=kt(e,o);let n=Dt(e,o),s=ke(n),a=$m(o,s);return qr(a,s,n)}var fN,dN=h(()=>{me();P();hr();jx();F();il();an();fN=T({divNoNan_:XH})});function jH(r,t){let e=C(r,"t1","dot"),o=C(t,"t2","dot");$((e.rank===1||e.rank===2)&&(o.rank===1||o.rank===2),()=>`Error in dot: inputs must all be rank 1 or 2, but got ranks ${e.rank} and ${o.rank}.`);let n=e.rank===1?e.size:e.shape[1],s=o.rank===1?o.size:o.shape[0];if($(n===s,()=>`Error in dot: inner dimensions of inputs must match, but got ${n} and ${s}.`),e.rank===1&&o.rank===1){let a=z(e,[1,-1]),i=z(o,[-1,1]),c=zt(a,i);return z(c,[])}else if(e.rank===1&&o.rank===2){let a=z(e,[1,-1]),i=z(o,[o.shape[0],o.shape[1]]),c=zt(a,i);return z(c,[c.size])}else if(e.rank===2&&o.rank===1){let a=z(o,[-1,1]),i=zt(e,a);return z(i,[i.size])}else{let a=z(o,[o.shape[0],o.shape[1]]);return zt(e,a)}}var hN,gN=h(()=>{P();X();Vn();F();Et();hN=T({dot_:jH})});function YH(r,...t){let e=t.map((n,s)=>C(n,`tensors${s}`,"einsum")),o={equation:r};return E.runKernel(Vi,e,o)}var Un,Yx=h(()=>{B();H();P();F();Un=T({einsum_:YH})});function ZH(r){let e={x:C(r,"x","elu","float32")};return E.runKernel("Elu",e)}var Rm,Zx=h(()=>{B();P();F();Rm=T({elu_:ZH})});function QH(r,t){let e=C(r,"x","ensureShape","string_or_numeric");if(!Hg(e.shape,t))throw new Error(`EnsureShape: Shape of tensor ${e.shape} is not compatible with expected shape ${t}`);return r}var xN,yN=h(()=>{P();Re();F();xN=T({ensureShape_:QH})});function JH(r){let t=C(r,"x","erf");$(t.dtype==="int32"||t.dtype==="float32",()=>"Input dtype must be `int32` or `float32`."),t.dtype==="int32"&&(t=_t(t,"float32"));let e={x:t};return E.runKernel("Erf",e)}var bN,vN=h(()=>{B();P();X();rr();F();bN=T({erf_:JH})});function Qx(r,t){for(let e=0;e<r.length;++e)if(r[r.length-e-1]!==t-1-e)return!1;return!0}function wN(r,t,e){let o=r.length+t.length,n=[],s=0,a=0;for(let i=0;i<o;i++)e.indexOf(i)===-1?n.push(r[s++]):n.push(t[a++]);return n}function tK(r,t){let e=[],o=r.length;for(let s=0;s<o;s++)t.indexOf(s)===-1&&e.push(r[s]);let n=t.map(s=>r[s]);return[e,n]}function cn(r,t){let e=t.map(o=>1);return wN(r,e,t)}function eK(r,t,e){$(Qx(t,e),()=>`${r} supports only inner-most axes for now. Got axes ${t} and rank-${e} input.`)}function rK(r,t){if(Qx(r,t))return null;let e=[];for(let o=0;o<t;++o)r.indexOf(o)===-1&&e.push(o);return r.forEach(o=>e.push(o)),e}function oK(r){return r.map((t,e)=>[e,t]).sort((t,e)=>t[1]-e[1]).map(t=>t[0])}function nK(r,t){let e=[];for(let o=t-r;o<t;++o)e.push(o);return e}var cl=h(()=>{X();});function aK(r,t=null,e=!1){let n={x:C(r,"x","max")},s={reductionIndices:t,keepDims:e};return E.runKernel("Max",n,s)}var Bo,Su=h(()=>{B();P();F();Bo=T({max_:aK})});function iK(r,t=null,e=!1){let n={x:C(r,"x","min")},s={axis:t,keepDims:e};return E.runKernel("Min",n,s)}var Nu,Jx=h(()=>{B();P();F();Nu=T({min_:iK})});function cK(r,t){let e=C(r,"base","pow"),o=C(t,"exp","pow");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel("Pow",n)}var ln,Iu=h(()=>{B();me();P();F();ln=T({pow_:cK})});function bt(r,t){if((er(r)&&t!=="string"||Array.isArray(r))&&t!=="complex64")throw new Error("Error creating a new Scalar: value must be a primitive (number|boolean|string)");if(t==="string"&&er(r)&&!(r instanceof Uint8Array))throw new Error("When making a scalar from encoded string, the value must be `Uint8Array`.");return ar(r,[],[],t)}var nr=h(()=>{X();rn();});function lK(r){let e={x:C(r,"x","sqrt","float32")};return E.runKernel(ra,e)}var xr,ll=h(()=>{B();H();P();F();xr=T({sqrt_:lK})});function uK(r){let t=C(r,"x","square"),e={};return E.runKernel("Square",{x:t},e)}var Ve,un=h(()=>{B();P();F();Ve=T({square_:uK})});function pK(r,t=null,e=!1){let o=C(r,"x","sum");o.dtype==="bool"&&(o=_t(o,"int32"));let n={x:o},s={axis:t,keepDims:e};return E.runKernel("Sum",n,s)}var Gt,vo=h(()=>{B();P();rr();F();Gt=T({sum_:pK})});function mK(r,t="euclidean",e=null,o=!1){r=C(r,"x","norm");let n=CN(r,t,e),s=n.shape;if(o){let a=In(e,r.shape);s=cn(n.shape,a)}return z(n,s)}function CN(r,t,e=null){if(r.rank===0)return Be(r);if(r.rank!==1&&e===null)return CN(z(r,[-1]),t,e);if(r.rank===1||typeof e=="number"||Array.isArray(e)&&e.length===1){if(t===1)return Gt(Be(r),e);if(t===1/0)return Bo(Be(r),e);if(t===-1/0)return Nu(Be(r),e);if(t==="euclidean"||t===2)return xr(Gt(ln(Be(r),bt(2,"int32")),e));throw new Error(`Error in norm: invalid ord value: ${t}`)}if(Array.isArray(e)&&e.length===2){if(t===1)return Bo(Gt(Be(r),e[0]),e[1]-1);if(t===1/0)return Bo(Gt(Be(r),e[1]),e[0]);if(t===-1/0)return Nu(Gt(Be(r),e[1]),e[0]);if(t==="fro"||t==="euclidean")return xr(Gt(Ve(r),e));throw new Error(`Error in norm: invalid ord value: ${t}`)}throw new Error(`Error in norm: invalid axis: ${e}`)}var Na,ku=h(()=>{P();X();wa();cl();Su();Jx();F();Iu();Et();nr();ll();un();vo();Na=T({norm_:mK})});function fK(r,t=null,e=!1){return Na(r,"euclidean",t,e)}var SN,NN=h(()=>{ku();F();SN=T({euclideanNorm_:fK})});function dK(r){let e={x:C(r,"x","exp")};return E.runKernel("Exp",e)}var no,ul=h(()=>{B();P();F();no=T({exp_:dK})});function hK(r,t=0){let e=C(r,"x","expandDims","string_or_numeric");$(t<=e.rank,()=>"Axis must be <= rank of the tensor");let o={input:e},n={dim:t};return E.runKernel(zi,o,n)}var _r,Fm=h(()=>{B();H();P();X();F();_r=T({expandDims_:hK})});function gK(r){let e={x:C(r,"x","expm1")};return E.runKernel(Es,e)}var TN,IN=h(()=>{B();H();P();F();TN=T({expm1_:gK})});function xK(r,t){let e=C(r,"x","tile","string_or_numeric");$(e.rank===t.length,()=>`Error in transpose: rank of input ${e.rank} must match length of reps ${t}.`);let o={x:e},n={reps:t};return E.runKernel(Rn,o,n)}var Hn,Om=h(()=>{B();H();P();X();F();Hn=T({tile_:xK})});function yK(r,t,e,o="float32"){t==null&&(t=r);let n=ut([r,t],o),s=r<=t?r:t;for(let i=0;i<s;++i)n.set(1,i,i);let a=z(n.toTensor(),[r,t]);if(e==null)return a;if(e.length===1)return Hn(_r(a,0),[e[0],1,1]);if(e.length===2)return Hn(_r(_r(a,0),0),[e[0],e[1],1,1]);if(e.length===3)return Hn(_r(_r(_r(a,0),0),0),[e[0],e[1],e[2],1,1]);throw new Error(`eye() currently supports only 1D and 2D batchShapes, but received ${e.length}D.`)}var Pm,ty=h(()=>{sn();Fm();F();Et();Om();Pm=T({eye_:yK})});function bK(r){let e={x:C(r,"x","floor","float32")};return E.runKernel($s,e)}var Lm,ey=h(()=>{B();H();P();F();Lm=T({floor_:bK})});function vK(r,t,e=0,o=0){let n=C(r,"x","gather"),s=C(t,"indices","gather","int32"),a={x:n,indices:s},i={axis:e,batchDims:o};return E.runKernel(Hi,a,i)}var Mm,ry=h(()=>{B();H();P();F();Mm=T({gather_:vK})});function wK(r,t){let e=C(r,"a","greater","string_or_numeric"),o=C(t,"b","greater","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(As,n)}var Ta,Bm=h(()=>{B();H();me();P();_e();F();Ta=T({greater_:wK})});function CK(r,t){let e=C(r,"a","greaterEqual","string_or_numeric"),o=C(t,"b","greaterEqual","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(_s,n)}var Vm,oy=h(()=>{B();H();me();P();_e();F();Vm=T({greaterEqual_:CK})});function SK(r){let e={input:C(r,"input","imag")};return E.runKernel(Xi,e)}var Kn,$u=h(()=>{B();H();P();F();Kn=T({imag_:SK})});function NK(r){let e={x:C(r,"x","isFinite")};return E.runKernel(Ds,e)}var kN,EN=h(()=>{B();H();P();F();kN=T({isFinite_:NK})});function TK(r){let e={x:C(r,"x","isInf")};return E.runKernel(Fs,e)}var $N,RN=h(()=>{B();H();P();F();$N=T({isInf_:TK})});function IK(r){let e={x:C(r,"x","isNaN")};return E.runKernel(Os,e)}var AN,_N=h(()=>{B();H();P();F();AN=T({isNaN_:IK})});function kK(r,t=.2){let o={x:C(r,"x","leakyRelu")},n={alpha:t};return E.runKernel(ji,o,n)}var zm,ny=h(()=>{B();H();P();F();zm=T({leakyRelu_:kK})});function EK(r,t){let e=C(r,"a","less","string_or_numeric"),o=C(t,"b","less","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Ps,n)}var Ru,sy=h(()=>{B();H();me();P();_e();F();Ru=T({less_:EK})});function $K(r,t){let e=C(r,"a","lessEqual","string_or_numeric"),o=C(t,"b","lessEqual","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Ls,n)}var pl,Gm=h(()=>{B();H();me();P();_e();F();pl=T({lessEqual_:$K})});function DN(r,t,e){if(e<=0)throw new Error("The number of values should be positive.");let o={start:r,stop:t,num:e};return E.runKernel(Yi,{},o)}var FN=h(()=>{B();H();});function RK(r,t=5,e=1,o=1,n=.5){let s=C(r,"x","localResponseNormalization");$(s.rank===4||s.rank===3,()=>`Error in localResponseNormalization: x must be rank 3 or 4 but got
               rank ${s.rank}.`),$(Jo(t),()=>`Error in localResponseNormalization: depthRadius must be an integer but got depthRadius ${t}.`);let a=s,i=!1;s.rank===3&&(i=!0,a=z(s,[1,s.shape[0],s.shape[1],s.shape[2]]));let c={x:a},l={depthRadius:t,bias:e,alpha:o,beta:n},u=E.runKernel("LRN",c,l);return i?z(u,[u.shape[1],u.shape[2],u.shape[3]]):u}var ON,PN=h(()=>{B();P();X();F();Et();ON=T({localResponseNormalization_:RK})});function AK(r){let e={x:C(r,"x","log","float32")};return E.runKernel("Log",e)}var pn,_u=h(()=>{B();P();F();pn=T({log_:AK})});function _K(r){let e={x:C(r,"x","log1p")};return E.runKernel(Ms,e)}var Um,ay=h(()=>{B();H();P();F();Um=T({log1p_:_K})});function LN(r,t){$(ui(r),()=>"The f passed in variableGrads(f) must be a function"),$(t==null||Array.isArray(t)&&t.every(l=>l instanceof en),()=>"The varList passed in variableGrads(f, varList) must be an array of variables");let e=t!=null;if(!e){t=[];for(let l in E.registeredVariables)t.push(E.registeredVariables[l])}let o=e?t.filter(l=>!l.trainable):null,n=t.length;t=t.filter(l=>l.trainable),$(t.length>0,()=>`variableGrads() expects at least one of the input variables to be trainable, but none of the ${n} variables is trainable.`);let s=!0,{value:a,grads:i}=E.gradients(r,t,null,s);$(i.some(l=>l!=null),()=>"Cannot find a connection between any variable and the result of the loss function y=f(x). Please make sure the operations that use variables are inside the function f passed to minimize()."),$(a.rank===0,()=>`The f passed in variableGrads(f) must return a scalar, but it returned a rank-${a.rank} tensor`);let c={};return t.forEach((l,u)=>{i[u]!=null&&(c[l.name]=i[u])}),o!=null&&o.forEach(l=>c[l.name]=null),{value:a,grads:c}}function yr(r){return E.customGrad(r)}var qn=h(()=>{B();Kr();X();});function DK(r){let e={x:C(r,"x","neg")};return E.runKernel("Neg",e)}var Xe,mn=h(()=>{B();P();F();Xe=T({neg_:DK})});function FK(r){let e={x:C(r,"x","softplus")};return E.runKernel(ea,e)}var Km,iy=h(()=>{B();H();P();F();Km=T({softplus_:FK})});function OK(r){let t=C(r,"x","logSigmoid");return yr(o=>({value:Xe(Km(Xe(o))),gradFunc:a=>tt(a,bo(Xe(o)))}))(t)}var MN,BN=h(()=>{qn();P();ae();mn();F();gu();iy();MN=T({logSigmoid_:OK})});function PK(r,t){let e=C(r,"a","sub"),o=C(t,"b","sub");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel("Sub",n)}var vt,De=h(()=>{B();me();P();F();vt=T({sub_:PK})});function LK(r,t=-1){let e=C(r,"logits","logSoftmax");if(t===-1&&(t=e.rank-1),t!==e.rank-1)throw Error(`Log Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and axis was ${t}`);return yr((n,s)=>{let i=Bo(n,t,!0),c=vt(n,i),l=vt(_t(c,"float32"),pn(Gt(no(c),t,!0)));return s([l]),{value:l,gradFunc:(p,m)=>{let[f]=m,d=!0,x=no(f);return vt(p,tt(Gt(p,t,d),x))}}})(e)}var VN,zN=h(()=>{qn();P();rr();ul();_u();Su();ae();F();De();vo();VN=T({logSoftmax_:LK})});function MK(r,t=null,e=!1){let o=C(r,"x","logSumExp"),n=In(t,o.shape),s=Bo(o,n,!0),a=vt(o,s),i=no(a),c=Gt(i,n),l=pn(c),u=mt(z(s,l.shape),l);if(e){let p=cn(u.shape,n);return z(u,p)}return u}var qm,cy=h(()=>{P();X();Ie();cl();ul();_u();Su();F();Et();De();vo();qm=T({logSumExp_:MK})});function BK(r,t){let e=C(r,"a","logicalAnd","bool"),o=C(t,"b","logicalAnd","bool");Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Bs,n)}var Ia,Xm=h(()=>{B();H();P();_e();F();Ia=T({logicalAnd_:BK})});function VK(r){let e={x:C(r,"x","logicalNot","bool")};return E.runKernel(Vs,e)}var jm,ly=h(()=>{B();H();P();F();jm=T({logicalNot_:VK})});function zK(r,t){let e=C(r,"a","logicalOr","bool"),o=C(t,"b","logicalOr","bool");Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(zs,n)}var Ym,uy=h(()=>{B();H();P();_e();F();Ym=T({logicalOr_:zK})});function GK(r,t){let e=C(r,"a","logicalXor","bool"),o=C(t,"b","logicalXor","bool");return Vt(e.shape,o.shape),Ia(Ym(r,t),jm(Ia(r,t)))}var GN,WN=h(()=>{P();_e();Xm();ly();uy();F();GN=T({logicalXor_:GK})});function WK(r,t,e="left"){let o=C(r,"sortedSequence","searchSorted"),n=C(t,"values","searchSorted"),s=o.shape[o.shape.length-1],a=n.shape[n.shape.length-1],i=z(o,[-1,s]),c=z(n,[-1,a]);if(i.rank<2)throw new Error("Sorted input argument must be at least 2-dimensional");if(i.shape[0]!==c.shape[0])throw new Error("Leading dimension of 'sortedSequence' and 'values' must match.");if($t(c.shape)>=Zm)throw new Error(`values tensor size must less than ${Zm}`);if(i.shape[1]>=Zm)throw new Error(`trailing dim_size must less than ${Zm} for int32 output type, was ${i.shape[1]}`);let l={sortedSequence:i,values:c},u={side:e};return E.runKernel(Sc,l,u)}var Zm,Fu,Qm=h(()=>{B();H();P();Re();F();Et();Zm=2147483648;Fu=T({searchSorted_:WK})});function UN(r,t){return Fu(r,t,"left")}var HN=h(()=>{Qm();});function UK(r,t,e,o,n){let s=C(r,"x","maxPool"),a=1,i=s,c=!1;s.rank===3&&(c=!0,i=z(s,[1,s.shape[0],s.shape[1],s.shape[2]])),$(i.rank===4,()=>`Error in maxPool: input must be rank 4 but got rank ${i.rank}.`),$(or(e,a),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${a}'`),ve("maxPool",o,n);let l={x:i},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n},p=E.runKernel(Zi,l,u);return c?z(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var Jm,py=h(()=>{B();H();P();X();gr();F();Et();Jm=T({maxPool_:UK})});function HK(r,t=[1,1,1],e,o,n,s="NDHWC"){let a=C(r,"x","maxPool3d"),i=a,c=!1;a.rank===4&&(c=!0,i=z(a,[1,a.shape[0],a.shape[1],a.shape[2],a.shape[3]])),$(i.rank===5,()=>`Error in maxPool3d: x must be rank 5 but got rank ${i.rank}.`),$(s==="NDHWC",()=>`Error in maxPool3d: Only NDHWC is currently supported, but got dataFormat of ${s}`),ve("maxPool3d",o,n);let l={x:i},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n,dataFormat:s},p=E.runKernel(Qi,l,u);return c?z(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}var KN,qN=h(()=>{B();H();P();X();gr();F();Et();KN=T({maxPool3d_:HK})});function KK(r,t,e,o,n=!1){let a={x:C(r,"x","maxPoolWithArgmax")},i={filterSize:t,strides:e,pad:o,includeBatchInIndex:n},c=E.runKernel(Ji,a,i);return{result:c[0],indexes:c[1]}}var XN,jN=h(()=>{B();H();P();F();XN=T({maxPoolWithArgmax_:KK})});function qK(r,t){let e=C(r,"a","maximum"),o=C(t,"b","maximum");[e,o]=kt(e,o),e.dtype==="bool"&&(e=_t(e,"int32"),o=_t(o,"int32")),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Gs,n)}var tf,my=h(()=>{B();H();me();P();_e();rr();F();tf=T({maximum_:qK})});function XK(r,t=null,e=!1){let n={x:C(r,"x","mean")},s={axis:t,keepDims:e};return E.runKernel(tc,n,s)}var ka,ef=h(()=>{B();H();P();F();ka=T({mean_:XK})});function Xr(r,t="float32"){if(oe(r),t==="complex64"){let o=Xr(r,"float32"),n=Xr(r,"float32");return mr(o,n)}let e=mi($t(r),t);return E.makeTensor(e,r,t)}var Ou=h(()=>{B();X();On();});function Vo(r,t="float32"){if(oe(r),t==="complex64"){let o=Vo(r,"float32"),n=Xr(r,"float32");return mr(o,n)}let e=Jl($t(r),t);return E.makeTensor(e,r,t)}var rf=h(()=>{B();X();Re();On();Ou();});function YN(r,t,{indexing:e="xy"}={}){if(e!=="xy"&&e!=="ij")throw new TypeError(`${e} is not a valid third argument to meshgrid`);if(r===void 0)return[];let o=C(r,"x","meshgrid",r instanceof ee?r.dtype:"float32");if(t===void 0)return[o];let n=C(t,"y","meshgrid",t instanceof ee?t.dtype:"float32"),s=$t(o.shape),a=$t(n.shape);return e==="xy"?(o=z(o,[1,-1]),n=z(n,[-1,1]),[zt(Vo([a,1],o.dtype),o),zt(n,Vo([1,s],n.dtype))]):(o=z(o,[-1,1]),n=z(n,[1,-1]),[zt(o,Vo([1,a],o.dtype)),zt(Vo([s,1],n.dtype),n)])}var ZN=h(()=>{Vn();rf();Et();Kr();P();Re();});function jK(r,t){let e=C(r,"a","minimum"),o=C(t,"b","minimum");[e,o]=kt(e,o),e.dtype==="bool"&&(e=_t(e,"int32"),o=_t(o,"int32")),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Ws,n)}var Ea,of=h(()=>{B();H();me();P();_e();rr();F();Ea=T({minimum_:jK})});function YK(r,t,e){$(e==="reflect"||e==="symmetric",()=>`Invalid mode. Mode must be either reflect or symmetric. Got ${e}.`);let o=C(r,"x","mirrorPad");if(o.rank===0)throw new Error("mirrorPad(scalar) is not defined. Pass non-scalar to mirrorPad");$(t.length===o.rank,()=>`Padding doesn't match input. Must be ${o.rank}. Got ${t.length}.`);let n=e==="reflect"?1:0;for(let i=0;i<o.rank;i++)$(t[i].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),$(t[i][0]>=0&&t[i][0]<=o.shape[i]-n&&t[i][1]>=0&&t[i][1]<=o.shape[i]-n,()=>`Padding in dimension ${i} cannot be greater than or equal to ${o.shape[i]-n} or less than 0 for input of shape ${o.shape}`);let s={paddings:t,mode:e},a={x:o};return E.runKernel(ec,a,s)}var QN,JN=h(()=>{B();H();P();X();F();QN=T({mirrorPad_:YK})});function ZK(r,t){let e=C(r,"a","mod"),o=C(t,"b","mod");[e,o]=kt(e,o);let n={a:e,b:o};return E.runKernel("Mod",n)}var tT,eT=h(()=>{B();me();P();F();tT=T({mod_:ZK})});function QK(r,t=null,e=!1){r=C(r,"x","moments");let o=In(t,r.shape),n=ka(r,o,e),s=n.shape;e||(s=cn(n.shape,o));let a=Ve(vt(_t(r,"float32"),z(n,s))),i=ka(a,o,e);return{mean:n,variance:i}}var rT,oT=h(()=>{P();X();cl();rr();ef();F();Et();un();De();rT=T({moments_:QK})});function JK(r,t,e,o){let n=C(t,"data","multiRNNCell"),s=xa(e,"c","multiRNNCell"),a=xa(o,"h","multiRNNCell"),i=n,c=[];for(let p=0;p<r.length;p++){let m=r[p](i,s[p],a[p]);c.push(m[0]),c.push(m[1]),i=m[1]}let l=[],u=[];for(let p=0;p<c.length;p+=2)l.push(c[p]),u.push(c[p+1]);return[l,u]}var nT,sT=h(()=>{P();F();nT=T({multiRNNCell_:JK})});function tq(r,t,e,o=!1){let n=C(r,"logits","multinomial"),s=n.size,a=n.rank;if(s<2)throw new Error(`Error in multinomial: you need at least 2 outcomes, but got ${s}.`);if(a>2)throw new Error(`Rank of probabilities must be 1 or 2, but is ${a}`);e=e||Math.random();let c={logits:a===1?z(n,[1,-1]):n},l={numSamples:t,seed:e,normalized:o},u=E.runKernel(rc,c,l);return a===1?z(u,[u.size]):u}var aT,iT=h(()=>{B();H();P();F();Et();aT=T({multinomial_:tq})});function eq(r,t){let e=C(r,"a","notEqual","string_or_numeric"),o=C(t,"b","notEqual","string_or_numeric");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o};return E.runKernel(Hs,n)}var nf,fy=h(()=>{B();H();me();P();_e();F();nf=T({notEqual_:eq})});function rq(r,t,e=1,o=0,n="int32"){if(t<2)throw new Error(`Error in oneHot: depth must be >=2, but it is ${t}`);let a={indices:C(r,"indices","oneHot","int32")},i={dtype:n,depth:t,onValue:e,offValue:o};return E.runKernel(ic,a,i)}var cT,lT=h(()=>{B();H();P();F();cT=T({oneHot_:rq})});function oq(r){let e={x:C(r,"x","onesLike")};return E.runKernel(ac,e)}var uT,pT=h(()=>{B();H();P();F();uT=T({onesLike_:oq})});function nq(r,t){let e=C(r,"v1","outerProduct"),o=C(t,"v2","outerProduct");$(e.rank===1&&o.rank===1,()=>`Error in outerProduct: inputs must be rank 1, but got ranks ${e.rank} and ${o.rank}.`);let n=z(e,[-1,1]),s=z(o,[1,-1]);return zt(n,s)}var mT,fT=h(()=>{P();X();Vn();F();Et();mT=T({outerProduct_:nq})});function sq(r,t,e=0){let o=C(r,"x","pad");if(o.rank===0)throw new Error("pad(scalar) is not defined. Pass non-scalar to pad");let n={paddings:t,constantValue:e},s={x:o};return E.runKernel(lc,s,n)}var zo,ml=h(()=>{B();H();P();F();zo=T({pad_:sq})});function aq(r,t,e=0){return $(t.length===2,()=>"Invalid number of paddings. Must be length of 2."),zo(r,[t],e)}var dT,hT=h(()=>{X();F();ml();dT=T({pad1d_:aq})});function iq(r,t,e=0){return $(t.length===2&&t[0].length===2&&t[1].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),zo(r,t,e)}var gT,xT=h(()=>{X();F();ml();gT=T({pad2d_:iq})});function cq(r,t,e=0){return $(t.length===3&&t[0].length===2&&t[1].length===2&&t[2].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),zo(r,t,e)}var yT,bT=h(()=>{X();F();ml();yT=T({pad3d_:cq})});function lq(r,t,e=0){return $(t.length===4&&t[0].length===2&&t[1].length===2&&t[2].length===2&&t[3].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),zo(r,t,e)}var vT,wT=h(()=>{X();F();ml();vT=T({pad4d_:lq})});function uq(r,t,e){let o=C(r,"x","spaceToBatchND");$(o.rank>=1+t.length,()=>`input rank ${o.rank} should be > than [blockShape] ${t.length}`),$(e.length===t.length,()=>`paddings.shape[0] ${e.length} must be equal to [blockShape] ${t.length}`),$(o.shape.reduce((a,i,c)=>c>0&&c<=t.length?a&&(i+e[c-1][0]+e[c-1][1])%t[c-1]===0:a,!0),()=>`input spatial dimensions ${o.shape.slice(1)} with paddings ${e.toString()} must be divisible by blockShapes ${t.toString()}`);let n={x:o},s={blockShape:t,paddings:e};return E.runKernel(Ic,n,s)}var sf,dy=h(()=>{B();H();P();X();F();sf=T({spaceToBatchND_:uq})});function pq(r,t,e,o,n,s,a){n==null&&(n=[1,1]),s==null&&(s=1),o===0&&(o="valid");let i=C(r,"x","maxPool"),c=i,l=!1;i.rank===3&&(l=!0,c=z(i,[1,i.shape[0],i.shape[1],i.shape[2]])),$(or(s,n),()=>`Error in pool: Either strides or dilations must be 1. Got strides ${s} and dilations '${n}'`);let u=zx(c.shape,t,s,n,o),p=[u.dilationHeight,u.dilationWidth],m;o==="same"?m=fq([u.filterHeight,u.filterWidth],p):m=[[0,0],[0,0]];let f=p[0]===1&&p[1]===1,[d,x]=mq([u.inHeight,u.inWidth],p,m),g=f?o:"valid",y=f?c:sf(c,p,d),N=(e==="avg"?()=>Sm(y,t,s,g,a):()=>Jm(y,t,s,g,a))(),S=f?N:Nm(N,p,x);return l?z(S,[S.shape[1],S.shape[2],S.shape[3]]):S}function mq(r,t,e){let o=e.map(u=>u[0]),n=e.map(u=>u[1]),s=r.concat(o,n),a=t.map((u,p)=>(u-s[p]%u)%u),i=n.map((u,p)=>u+a[p]),c=t.map((u,p)=>[o[p],i[p]]),l=t.map((u,p)=>[0,a[p]]);return[c,l]}function fq(r,t){let o=r.map((a,i)=>a+(a-1)*(t[i]-1)).map(a=>a-1),n=o.map(a=>Math.floor(a/2)),s=o.map((a,i)=>a-n[i]);return o.map((a,i)=>[n[i],s[i]])}var CT,ST=h(()=>{P();X();Wx();Hx();gr();py();F();Et();dy();CT=T({pool_:pq})});function dq(r,t){let e=C(r,"x","prelu"),o=C(t,"alpha","prelu"),n={x:e,alpha:o};return E.runKernel(uc,n)}var af,hy=h(()=>{B();H();P();F();af=T({prelu_:dq})});function hq(r,t=null,e=!1){let o=C(r,"x","prod");o.dtype==="bool"&&(o=_t(o,"int32"));let n={x:o},s={axis:t,keepDims:e};return E.runKernel(pc,n,s)}var NT,TT=h(()=>{B();H();P();rr();F();NT=T({prod_:hq})});function gq(r,t,e,o){let n=r.map((u,p)=>C(u,`tensors${p}`,"raggedGather","int32")),s=C(t,"paramsDenseValues","raggedGather"),a=C(e,"indices","raggedGather","int32"),i={paramsNestedSplits:n,paramsDenseValues:s,indices:a},c={outputRaggedRank:o},l=E.runKernel(mc,i,c);return{outputNestedSplits:l.slice(0,l.length-1),outputDenseValues:l[l.length-1]}}var IT,kT=h(()=>{B();H();P();F();IT=T({raggedGather_:gq})});function xq(r,t,e){let o=C(r,"starts","raggedRange"),n=C(t,"limits","raggedRange",o.dtype),s=C(e,"deltas","raggedRange",o.dtype),a={starts:o,limits:n,deltas:s},i=E.runKernel(fc,a);return{rtNestedSplits:i[0],rtDenseValues:i[1]}}var ET,$T=h(()=>{B();H();P();F();ET=T({raggedRange_:xq})});function yq(r,t,e,o,n){let s=C(r,"shape","raggedTensorToTensor","int32"),a=C(t,"values","raggedTensorToTensor"),i=C(e,"defaultValue","raggedTensorToTensor",a.dtype),c=o.map((p,m)=>C(p,`tensors${m}`,"raggedTensorToTensor","int32")),l={shape:s,values:a,defaultValue:i,rowPartitionTensors:c},u={rowPartitionTypes:n};return E.runKernel(dc,l,u)}var RT,AT=h(()=>{B();H();P();F();RT=T({raggedTensorToTensor_:yq})});function bq(r,t,e){oe(r);let o=$t(r),n=null;if(e==null||e==="float32")n=new Float32Array(o);else if(e==="int32")n=new Int32Array(o);else if(e==="bool")n=new Uint8Array(o);else throw new Error(`Unknown data type ${e}`);for(let s=0;s<o;s++)n[s]=t();return E.makeTensor(n,r,e)}var _T,DT=h(()=>{B();X();Re();F();_T=T({rand_:bq})});var OT=Ur((FT,gy)=>{(function(r,t,e){function o(i){var c=this,l=a();c.next=function(){var u=2091639*c.s0+c.c*23283064365386963e-26;return c.s0=c.s1,c.s1=c.s2,c.s2=u-(c.c=u|0)},c.c=1,c.s0=l(" "),c.s1=l(" "),c.s2=l(" "),c.s0-=l(i),c.s0<0&&(c.s0+=1),c.s1-=l(i),c.s1<0&&(c.s1+=1),c.s2-=l(i),c.s2<0&&(c.s2+=1),l=null}function n(i,c){return c.c=i.c,c.s0=i.s0,c.s1=i.s1,c.s2=i.s2,c}function s(i,c){var l=new o(i),u=c&&c.state,p=l.next;return p.int32=function(){return l.next()*4294967296|0},p.double=function(){return p()+(p()*2097152|0)*11102230246251565e-32},p.quick=p,u&&(typeof u=="object"&&n(u,l),p.state=function(){return n(l,{})}),p}function a(){var i=4022871197,c=function(l){l=String(l);for(var u=0;u<l.length;u++){i+=l.charCodeAt(u);var p=.02519603282416938*i;i=p>>>0,p-=i,p*=i,i=p>>>0,p-=i,i+=p*4294967296}return(i>>>0)*23283064365386963e-26};return c}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.alea=s})(FT,typeof gy=="object"&&gy,typeof define=="function"&&define)});var LT=Ur((PT,xy)=>{(function(r,t,e){function o(a){var i=this,c="";i.x=0,i.y=0,i.z=0,i.w=0,i.next=function(){var u=i.x^i.x<<11;return i.x=i.y,i.y=i.z,i.z=i.w,i.w^=i.w>>>19^u^u>>>8},a===(a|0)?i.x=a:c+=a;for(var l=0;l<c.length+64;l++)i.x^=c.charCodeAt(l)|0,i.next()}function n(a,i){return i.x=a.x,i.y=a.y,i.z=a.z,i.w=a.w,i}function s(a,i){var c=new o(a),l=i&&i.state,u=function(){return(c.next()>>>0)/4294967296};return u.double=function(){do var p=c.next()>>>11,m=(c.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=c.next,u.quick=u,l&&(typeof l=="object"&&n(l,c),u.state=function(){return n(c,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xor128=s})(PT,typeof xy=="object"&&xy,typeof define=="function"&&define)});var BT=Ur((MT,yy)=>{(function(r,t,e){function o(a){var i=this,c="";i.next=function(){var u=i.x^i.x>>>2;return i.x=i.y,i.y=i.z,i.z=i.w,i.w=i.v,(i.d=i.d+362437|0)+(i.v=i.v^i.v<<4^(u^u<<1))|0},i.x=0,i.y=0,i.z=0,i.w=0,i.v=0,a===(a|0)?i.x=a:c+=a;for(var l=0;l<c.length+64;l++)i.x^=c.charCodeAt(l)|0,l==c.length&&(i.d=i.x<<10^i.x>>>4),i.next()}function n(a,i){return i.x=a.x,i.y=a.y,i.z=a.z,i.w=a.w,i.v=a.v,i.d=a.d,i}function s(a,i){var c=new o(a),l=i&&i.state,u=function(){return(c.next()>>>0)/4294967296};return u.double=function(){do var p=c.next()>>>11,m=(c.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=c.next,u.quick=u,l&&(typeof l=="object"&&n(l,c),u.state=function(){return n(c,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xorwow=s})(MT,typeof yy=="object"&&yy,typeof define=="function"&&define)});var zT=Ur((VT,by)=>{(function(r,t,e){function o(a){var i=this;i.next=function(){var l=i.x,u=i.i,p,m,f;return p=l[u],p^=p>>>7,m=p^p<<24,p=l[u+1&7],m^=p^p>>>10,p=l[u+3&7],m^=p^p>>>3,p=l[u+4&7],m^=p^p<<7,p=l[u+7&7],p=p^p<<13,m^=p^p<<9,l[u]=m,i.i=u+1&7,m};function c(l,u){var p,m,f=[];if(u===(u|0))m=f[0]=u;else for(u=""+u,p=0;p<u.length;++p)f[p&7]=f[p&7]<<15^u.charCodeAt(p)+f[p+1&7]<<13;for(;f.length<8;)f.push(0);for(p=0;p<8&&f[p]===0;++p);for(p==8?m=f[7]=-1:m=f[p],l.x=f,l.i=0,p=256;p>0;--p)l.next()}c(i,a)}function n(a,i){return i.x=a.x.slice(),i.i=a.i,i}function s(a,i){a==null&&(a=+new Date);var c=new o(a),l=i&&i.state,u=function(){return(c.next()>>>0)/4294967296};return u.double=function(){do var p=c.next()>>>11,m=(c.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=c.next,u.quick=u,l&&(l.x&&n(l,c),u.state=function(){return n(c,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xorshift7=s})(VT,typeof by=="object"&&by,typeof define=="function"&&define)});var WT=Ur((GT,vy)=>{(function(r,t,e){function o(a){var i=this;i.next=function(){var l=i.w,u=i.X,p=i.i,m,f;return i.w=l=l+1640531527|0,f=u[p+34&127],m=u[p=p+1&127],f^=f<<13,m^=m<<17,f^=f>>>15,m^=m>>>12,f=u[p]=f^m,i.i=p,f+(l^l>>>16)|0};function c(l,u){var p,m,f,d,x,g=[],y=128;for(u===(u|0)?(m=u,u=null):(u=u+"\0",m=0,y=Math.max(y,u.length)),f=0,d=-32;d<y;++d)u&&(m^=u.charCodeAt((d+32)%u.length)),d===0&&(x=m),m^=m<<10,m^=m>>>15,m^=m<<4,m^=m>>>13,d>=0&&(x=x+1640531527|0,p=g[d&127]^=m+x,f=p==0?f+1:0);for(f>=128&&(g[(u&&u.length||0)&127]=-1),f=127,d=512;d>0;--d)m=g[f+34&127],p=g[f=f+1&127],m^=m<<13,p^=p<<17,m^=m>>>15,p^=p>>>12,g[f]=m^p;l.w=x,l.X=g,l.i=f}c(i,a)}function n(a,i){return i.i=a.i,i.w=a.w,i.X=a.X.slice(),i}function s(a,i){a==null&&(a=+new Date);var c=new o(a),l=i&&i.state,u=function(){return(c.next()>>>0)/4294967296};return u.double=function(){do var p=c.next()>>>11,m=(c.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=c.next,u.quick=u,l&&(l.X&&n(l,c),u.state=function(){return n(c,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xor4096=s})(GT,typeof vy=="object"&&vy,typeof define=="function"&&define)});var HT=Ur((UT,wy)=>{(function(r,t,e){function o(a){var i=this,c="";i.next=function(){var u=i.b,p=i.c,m=i.d,f=i.a;return u=u<<25^u>>>7^p,p=p-m|0,m=m<<24^m>>>8^f,f=f-u|0,i.b=u=u<<20^u>>>12^p,i.c=p=p-m|0,i.d=m<<16^p>>>16^f,i.a=f-u|0},i.a=0,i.b=0,i.c=-1640531527,i.d=1367130551,a===Math.floor(a)?(i.a=a/4294967296|0,i.b=a|0):c+=a;for(var l=0;l<c.length+20;l++)i.b^=c.charCodeAt(l)|0,i.next()}function n(a,i){return i.a=a.a,i.b=a.b,i.c=a.c,i.d=a.d,i}function s(a,i){var c=new o(a),l=i&&i.state,u=function(){return(c.next()>>>0)/4294967296};return u.double=function(){do var p=c.next()>>>11,m=(c.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=c.next,u.quick=u,l&&(typeof l=="object"&&n(l,c),u.state=function(){return n(c,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.tychei=s})(UT,typeof wy=="object"&&wy,typeof define=="function"&&define)});var KT=Ur(()=>{});var XT=Ur((qT,cf)=>{(function(r,t,e){var o=256,n=6,s=52,a="random",i=e.pow(o,n),c=e.pow(2,s),l=c*2,u=o-1,p;function m(N,S,R){var A=[];S=S==!0?{entropy:!0}:S||{};var _=g(x(S.entropy?[N,v(t)]:N==null?y():N,3),A),D=new f(A),L=function(){for(var M=D.g(n),V=i,W=0;M<c;)M=(M+W)*o,V*=o,W=D.g(1);for(;M>=l;)M/=2,V/=2,W>>>=1;return(M+W)/V};return L.int32=function(){return D.g(4)|0},L.quick=function(){return D.g(4)/4294967296},L.double=L,g(v(D.S),t),(S.pass||R||function(M,V,W,G){return G&&(G.S&&d(G,D),M.state=function(){return d(D,{})}),W?(e[a]=M,V):M})(L,_,"global"in S?S.global:this==e,S.state)}function f(N){var S,R=N.length,A=this,_=0,D=A.i=A.j=0,L=A.S=[];for(R||(N=[R++]);_<o;)L[_]=_++;for(_=0;_<o;_++)L[_]=L[D=u&D+N[_%R]+(S=L[_])],L[D]=S;(A.g=function(M){for(var V,W=0,G=A.i,K=A.j,U=A.S;M--;)V=U[G=u&G+1],W=W*o+U[u&(U[G]=U[K=u&K+V])+(U[K]=V)];return A.i=G,A.j=K,W})(o)}function d(N,S){return S.i=N.i,S.j=N.j,S.S=N.S.slice(),S}function x(N,S){var R=[],A=typeof N,_;if(S&&A=="object")for(_ in N)try{R.push(x(N[_],S-1))}catch{}return R.length?R:A=="string"?N:N+"\0"}function g(N,S){for(var R=N+"",A,_=0;_<R.length;)S[u&_]=u&(A^=S[u&_]*19)+R.charCodeAt(_++);return v(S)}function y(){try{var N;return p&&(N=p.randomBytes)?N=N(o):(N=new Uint8Array(o),(r.crypto||r.msCrypto).getRandomValues(N)),v(N)}catch{var S=r.navigator,R=S&&S.plugins;return[+new Date,r,R,r.screen,v(t)]}}function v(N){return String.fromCharCode.apply(0,N)}if(g(e.random(),t),typeof cf=="object"&&cf.exports){cf.exports=m;try{p=KT()}catch{}}else typeof define=="function"&&define.amd?define(function(){return m}):e["seed"+a]=m})(typeof self!="undefined"?self:qT,[],Math)});var Cy=Ur((cbt,jT)=>{var vq=OT(),wq=LT(),Cq=BT(),Sq=zT(),Nq=WT(),Tq=HT(),$a=XT();$a.alea=vq;$a.xor128=wq;$a.xorwow=Cq;$a.xorshift7=Sq;$a.xor4096=Nq;$a.tychei=Tq;jT.exports=$a});var pf,Ra,lf,uf,Lu=h(()=>{pf=Wg(Cy());Ra=class{constructor(t,e,o,n,s){this.mean=t,this.stdDev=e,this.dtype=o,this.nextVal=NaN,this.truncated=n,this.truncated&&(this.upper=this.mean+this.stdDev*2,this.lower=this.mean-this.stdDev*2);let a=s||Math.random();this.random=pf.alea(a.toString())}nextValue(){if(!isNaN(this.nextVal)){let n=this.nextVal;return this.nextVal=NaN,n}let t,e,o=!1;for(;!o;){let n,s,a;do n=2*this.random()-1,s=2*this.random()-1,a=n*n+s*s;while(a>=1||a===0);let i=Math.sqrt(-2*Math.log(a)/a);t=this.mean+this.stdDev*n*i,e=this.mean+this.stdDev*s*i,(!this.truncated||this.isValidTruncated(t))&&(o=!0)}return(!this.truncated||this.isValidTruncated(e))&&(this.nextVal=this.convertValue(e)),this.convertValue(t)}convertValue(t){return this.dtype==null||this.dtype==="float32"?t:Math.round(t)}isValidTruncated(t){return t<=this.upper&&t>=this.lower}},lf=class{constructor(t,e,o,n){this.alpha=t,this.beta=1/e,this.dtype=o;let s=n||Math.random();this.randu=pf.alea(s.toString()),this.randn=new Ra(0,1,o,!1,this.randu()),t<1?this.d=t+2/3:this.d=t-1/3,this.c=1/Math.sqrt(9*this.d)}nextValue(){let t,e,o,n,s,a;for(;;){do n=this.randn.nextValue(),a=1+this.c*n;while(a<=0);if(a*=a*a,t=n*n,e=1-.331*t*t,o=.5*t+this.d*(1-a+Math.log(a)),s=this.randu(),s<e||Math.log(s)<o)break}return a=1/this.beta*this.d*a,this.alpha<1&&(a*=Math.pow(this.randu(),1/this.alpha)),this.convertValue(a)}convertValue(t){return this.dtype==="float32"?t:Math.round(t)}},uf=class{constructor(t=0,e=1,o,n){if(this.canReturnFloat=()=>this.dtype==null||this.dtype==="float32",this.min=t,this.range=e-t,this.dtype=o,n==null&&(n=Math.random()),typeof n=="number"&&(n=n.toString()),!this.canReturnFloat()&&this.range<=1)throw new Error(`The difference between ${t} - ${e} <= 1 and dtype is not float`);this.random=pf.alea(n)}convertValue(t){return this.canReturnFloat()?t:Math.round(t)}nextValue(){return this.convertValue(this.min+this.range*this.random())}}});function Iq(r,t,e=1,o="float32",n){if(oe(r),e==null&&(e=1),o==null&&(o="float32"),o!=="float32"&&o!=="int32")throw new Error(`Unsupported data type ${o}`);let s=new lf(t,e,o,n),a=ut(r,o);for(let i=0;i<a.values.length;i++)a.values[i]=s.nextValue();return a.toTensor()}var YT,ZT=h(()=>{Re();sn();F();Lu();YT=T({randomGamma_:Iq})});function kq(r,t=0,e=1,o,n){if(oe(r),o!=null&&o==="bool")throw new Error(`Unsupported data type ${o}`);let s=new Ra(t,e,o,!1,n),a=ut(r,o);for(let i=0;i<a.values.length;i++)a.values[i]=s.nextValue();return a.toTensor()}var mf,Sy=h(()=>{Re();sn();F();Lu();mf=T({randomNormal_:kq})});function Eq(r,t,e){if(t!=null&&t==="bool")throw new Error(`Unsupported data type ${t}`);return mf(r,0,1,t,e)}var QT,JT=h(()=>{F();Sy();QT=T({randomStandardNormal_:Eq})});function $q(r,t=0,e=1,o="float32",n){oe(r);let s=ut(r,o),a=new uf(t,e,null,n);for(let i=0;i<s.values.length;i++)s.values[i]=a.nextValue();return s.toTensor()}var fl,ff=h(()=>{Re();sn();F();Lu();fl=T({randomUniform_:$q})});function Rq(r,t,e,o){return fl(r,t,e,"int32",o)}var t1,e1=h(()=>{F();ff();t1=T({randomUniformInt_:Rq})});function Xn(r,t,e=1,o="float32"){if(e===0)throw new Error("Cannot have a step of zero");let n={start:r,stop:t,step:e,dtype:o};return E.runKernel(hc,{},n)}var df=h(()=>{B();H();});function Aq(r){let e={input:C(r,"input","real")};return E.runKernel(gc,e)}var fn,Mu=h(()=>{B();H();P();F();fn=T({real_:Aq})});function _q(r){let e={x:C(r,"x","reciprocal")};return E.runKernel(Ks,e)}var r1,o1=h(()=>{B();H();P();F();r1=T({reciprocal_:_q})});function Dq(r){let e={x:C(r,"x","relu")};return E.runKernel(qs,e)}var jn,Bu=h(()=>{B();H();P();F();jn=T({relu_:Dq})});function Fq(r){let e={x:C(r,"x","relu6")};return E.runKernel(Xs,e)}var hf,Ny=h(()=>{B();H();P();F();hf=T({relu6_:Fq})});function Oq(r,t){let o={x:C(r,"x","reverse")},n={dims:t};return E.runKernel(vc,o,n)}var jr,Aa=h(()=>{B();H();P();F();jr=T({reverse_:Oq})});function Pq(r){let t=C(r,"x","reverse");return $(t.rank===1,()=>`Error in reverse1D: x must be rank 1 but got rank ${t.rank}.`),jr(t,0)}var n1,s1=h(()=>{P();X();F();Aa();n1=T({reverse1d_:Pq})});function Lq(r,t){let e=C(r,"x","reverse");return $(e.rank===2,()=>`Error in reverse2D: x must be rank 2 but got rank ${e.rank}.`),jr(e,t)}var a1,i1=h(()=>{P();X();F();Aa();a1=T({reverse2d_:Lq})});function Mq(r,t){let e=C(r,"x","reverse");return $(e.rank===3,()=>`Error in reverse3D: x must be rank 3 but got rank ${e.rank}.`),jr(e,t)}var c1,l1=h(()=>{P();X();F();Aa();c1=T({reverse3d_:Mq})});function Bq(r,t){let e=C(r,"x","reverse");return $(e.rank===4,()=>`Error in reverse4D: x must be rank 4 but got rank ${e.rank}.`),jr(e,t)}var u1,p1=h(()=>{P();X();F();Aa();u1=T({reverse4d_:Bq})});function Vq(r){let e={x:C(r,"x","round")};return E.runKernel(js,e)}var gf,Ty=h(()=>{B();H();P();F();gf=T({round_:Vq})});function zq(r){let e={x:C(r,"x","rsqrt","float32")};return E.runKernel(Ys,e)}var m1,f1=h(()=>{B();H();P();F();m1=T({rsqrt_:zq})});function Gq(r){let e={x:C(r,"x","selu")};return E.runKernel(Zs,e)}var d1,h1=h(()=>{B();H();P();F();d1=T({selu_:Gq})});function Wq(r,t,e,o,n,s=[1,1],a="NHWC"){let i=C(r,"x","separableConv2d"),c=C(t,"depthwiseFilter","separableConv2d"),l=C(e,"pointwiseFilter","separableConv2d"),u=i,p=!1;if(i.rank===3&&(p=!0,u=z(i,[1,i.shape[0],i.shape[1],i.shape[2]])),a==="NCHW")throw new Error("separableConv2d currently does not support dataFormat NCHW; only NHWC is supported");$(u.rank===4,()=>`Error in separableConv2d: input must be rank 4, but got rank ${u.rank}.`),$(c.rank===4,()=>`Error in separableConv2d: depthwise filter must be rank 4, but got rank ${c.rank}.`),$(l.rank===4,()=>`Error in separableConv2d: pointwise filter must be rank 4, but got rank ${c.rank}.`),$(l.shape[0]===1,()=>`Error in separableConv2d: the first dimension of pointwise filter  must be 1, but got ${l.shape[0]}.`),$(l.shape[1]===1,()=>`Error in separableConv2d: the second dimension of pointwise filter must be 1, but got ${l.shape[1]}.`);let m=c.shape[2],f=c.shape[3];$(l.shape[2]===m*f,()=>`Error in separableConv2d: the third dimension of pointwise filter must be ${m*f}, but got ${l.shape[2]}.`);let d=al(u,c,o,n,a,s),g=Wn(d,l,1,"valid",a);return p?z(g,[g.shape[1],g.shape[2],g.shape[3]]):g}var g1,x1=h(()=>{P();X();bu();km();F();Et();g1=T({separableConv2d_:Wq})});async function Uq(r,t){let e=C(r,"x","setdiff1d"),o=C(t,"y","setdiff1d");$(e.dtype===o.dtype,()=>`x and y should have the same dtype, but got x (${e.dtype}) and y (${o.dtype}).`),$(e.rank===1,()=>`x should be 1D tensor, but got x (${e.shape}).`),$(o.rank===1,()=>`y should be 1D tensor, but got y (${o.shape}).`);let n=await e.data(),s=await o.data(),a=new Set(s),i=0;for(let u=0;u<n.length;u++)a.has(n[u])||i++;let c=new Bt([i],e.dtype),l=new Bt([i],"int32");for(let u=0,p=0;u<n.length;u++)a.has(n[u])||(c.values[p]=n[u],l.values[p]=u,p++);return[c.toTensor(),l.toTensor()]}var y1,b1=h(()=>{Kr();P();X();y1=Uq});function Hq(r){let e={x:C(r,"x","sign")};return E.runKernel(Js,e)}var v1,w1=h(()=>{B();H();P();F();v1=T({sign_:Hq})});function Kq(r){let e={x:C(r,"x","sin","float32")};return E.runKernel("Sin",e)}var C1,S1=h(()=>{B();P();F();C1=T({sin_:Kq})});function qq(r){let e={x:C(r,"x","sinh")};return E.runKernel(Qs,e)}var N1,T1=h(()=>{B();H();P();F();N1=T({sinh_:qq})});function Xq(r,t,e){let o=C(r,"x","slice1d");return $(o.rank===1,()=>`slice1d expects a rank-1 tensor, but got a rank-${o.rank} tensor`),Ft(o,[t],[e])}var I1,k1=h(()=>{P();X();F();oo();I1=T({slice1d_:Xq})});function jq(r,t,e){let o=C(r,"x","slice2d");return $(o.rank===2,()=>`slice2d expects a rank-2 tensor, but got a rank-${o.rank} tensor`),Ft(o,t,e)}var E1,$1=h(()=>{P();X();F();oo();E1=T({slice2d_:jq})});function Yq(r,t,e){let o=C(r,"x","slice3d");return $(o.rank===3,()=>`slice3d expects a rank-3 tensor, but got a rank-${o.rank} tensor`),Ft(o,t,e)}var R1,A1=h(()=>{P();X();F();oo();R1=T({slice3d_:Yq})});function Zq(r,t,e){let o=C(r,"x","slice4d");return $(o.rank===4,()=>`slice4d expects a rank-4 tensor, but got a rank-${o.rank} tensor`),Ft(o,t,e)}var _1,D1=h(()=>{P();X();F();oo();_1=T({slice4d_:Zq})});function Qq(r,t=-1){let e=C(r,"logits","softmax","float32");if(t===-1&&(t=e.rank-1),t!==e.rank-1)throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and dim was ${t}`);let o={logits:e},n={dim:t};return E.runKernel(Ec,o,n)}var F1,O1=h(()=>{B();H();P();F();F1=T({softmax_:Qq})});function Jq(r){$(r.dtype==="complex64",()=>`The dtype for tf.spectral.fft() must be complex64 but got ${r.dtype}.`);let t={input:r};return E.runKernel("FFT",t)}var dl,yf=h(()=>{B();X();F();dl=T({fft_:Jq})});function t6(r){$(r.dtype==="complex64",()=>`The dtype for tf.spectral.ifft() must be complex64 but got ${r.dtype}.`);let t={input:r};return E.runKernel(qi,t)}var _a,bf=h(()=>{B();H();X();F();_a=T({ifft_:t6})});function e6(r){let t=r.shape[r.shape.length-1],e=r.size/t,o;if(t<=2){let n=z(r,[e,t]);o=_a(n)}else{let n=[e,2*(t-1)],s=z(fn(r),[e,t]),a=z(Kn(r),[e,t]),i=jr(Ft(s,[0,1],[e,t-2]),1),c=tt(jr(Ft(a,[0,1],[e,t-2]),1),bt(-1)),l=Jt([s,i],1),u=Jt([a,c],1),p=z(mr(l,u),[n[0],n[1]]);o=_a(p)}if(o=fn(o),r.rank===3&&r.shape[0]!==0){let n=o,s=r.shape[0];o=z(o,[s,o.shape[0]/s,o.shape[1]]),n.dispose()}return o}var vf,Iy=h(()=>{On();yo();$u();ae();F();Mu();Et();Aa();nr();oo();bf();vf=T({irfft_:e6})});function r6(r,t,e=0){let n={x:C(r,"x","split")},s={numOrSizeSplits:t,axis:e};return E.runKernel(kc,n,s)}var dn,zu=h(()=>{B();H();P();F();dn=T({split_:r6})});function o6(r,t){$(r.dtype==="float32",()=>`The dtype for rfft() must be real value but got ${r.dtype}`);let e=r.shape[r.shape.length-1],o=r.size/e,n;if(t!=null&&t<e){let d=r.shape.map(g=>0),x=r.shape.map(g=>g);x[r.shape.length-1]=t,n=Ft(r,d,x),e=t}else if(t!=null&&t>e){let d=r.shape.map(x=>x);d[r.shape.length-1]=t-e,n=Jt([r,Xr(d)],r.shape.length-1),e=t}else n=r;let s=ke(n),a=z(mr(n,s),[o,e]),i=dl(a),c=Math.floor(e/2)+1,l=fn(i),u=Kn(i),p=dn(l,[c,e-c],l.shape.length-1),m=dn(u,[c,e-c],u.shape.length-1),f=n.shape.slice();return f[n.shape.length-1]=c,z(mr(p[0],m[0]),f)}var hl,wf=h(()=>{X();On();yo();$u();F();Mu();Et();oo();zu();Ou();an();yf();hl=T({rfft_:o6})});function n6(r,t){let e=C(r,"a","squaredDifference"),o=C(t,"b","squaredDifference");[e,o]=kt(e,o),Vt(e.shape,o.shape);let n={a:e,b:o},s={};return E.runKernel(oa,n,s)}var Cf,ky=h(()=>{B();H();me();P();_e();F();Cf=T({squaredDifference_:n6})});function s6(r,t){let e=C(r,"x","squeeze","string_or_numeric");return z(e,Kg(e.shape,t).newShape)}var Da,Sf=h(()=>{P();X();F();Et();Da=T({squeeze_:s6})});function a6(r,t=0){let e=xa(r,"tensors","stack","string_or_numeric");$(e.length>=1,()=>"Pass at least one tensor to tf.stack"),e.length>0&&$(t<=e[0].rank,()=>"Axis must be <= rank of the tensor");let o=e,n={axis:t};return E.runKernel(cc,o,n)}var cr,Gu=h(()=>{B();H();P();X();F();cr=T({stack_:a6})});function i6(r,t=0){let o={x:C(r,"x","step")},n={alpha:t};return E.runKernel(aa,o,n)}var Nf,Ey=h(()=>{B();H();P();F();Nf=T({step_:i6})});function c6(r,t,e,o,n=0,s=0,a=0,i=0,c=0){let u={x:C(r,"x","stridedSlice","string_or_numeric")},p={begin:t,end:e,strides:o,beginMask:n,endMask:s,ellipsisMask:a,newAxisMask:i,shrinkAxisMask:c};return E.runKernel(Fc,u,p)}var P1,L1=h(()=>{B();H();P();F();P1=T({stridedSlice_:c6})});function l6(r){let e={x:C(r,"x","tan","float32")};return E.runKernel("Tan",e)}var M1,B1=h(()=>{B();P();F();M1=T({tan_:l6})});function ze(r,t){Hr(r);let e=pr(r,t);if(e.length!==1)throw new Error("tensor1d() requires values to be a flat/TypedArray");return ar(r,null,e,t)}var Yn=h(()=>{P();X();rn();});function hn(r,t,e){if(Hr(r),t!=null&&t.length!==2)throw new Error("tensor2d() requires shape to have two numbers");let o=pr(r,e);if(o.length!==2&&o.length!==1)throw new Error("tensor2d() requires values to be number[][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor2d() requires shape to be provided when `values` are a flat/TypedArray");return ar(r,t,o,e)}var Tf=h(()=>{P();X();rn();});function If(r,t,e){if(Hr(r),t!=null&&t.length!==3)throw new Error("tensor3d() requires shape to have three numbers");let o=pr(r,e);if(o.length!==3&&o.length!==1)throw new Error("tensor3d() requires values to be number[][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor3d() requires shape to be provided when `values` are a flat array");return ar(r,t,o,e)}var $y=h(()=>{P();X();rn();});function V1(r,t,e){if(Hr(r),t!=null&&t.length!==4)throw new Error("tensor4d() requires shape to have four numbers");let o=pr(r,e);if(o.length!==4&&o.length!==1)throw new Error("tensor4d() requires values to be number[][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor4d() requires shape to be provided when `values` are a flat array");return ar(r,t,o,e)}var z1=h(()=>{P();X();rn();});function G1(r,t,e){if(Hr(r),t!=null&&t.length!==5)throw new Error("tensor5d() requires shape to have five numbers");let o=pr(r,e);if(o.length!==5&&o.length!==1)throw new Error("tensor5d() requires values to be number[][][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor5d() requires shape to be provided when `values` are a flat array");return ar(r,t,o,e)}var W1=h(()=>{P();X();rn();});function U1(r,t,e){if(Hr(r),t!=null&&t.length!==6)throw new Error("tensor6d() requires shape to have six numbers");let o=pr(r,e);if(o.length!==6&&o.length!==1)throw new Error("tensor6d() requires values to be number[][][][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor6d() requires shape to be provided when `values` are a flat array");return t=t||o,ar(r,t,o,e)}var H1=h(()=>{P();X();rn();});function K1(r,t,e){let o=t.rank>1?t.shape[t.rank-1]:1,n=t.rank>1?t.rank-1:1,s=`Must have updates.shape = indices.shape[:batchDim] + shape[sliceDim:], got updates.shape: ${e.shape}, indices.shape: ${t.shape}, shape: ${r}, sliceDim: ${o}, and batchDim: ${n}.`;if(e.rank<n)throw new Error(s+` update.rank < ${n}. `);if(r.length<o+(e.rank-n))throw new Error(s+` Output shape length < ${o+(e.rank-n)}`);if(e.rank!==n+r.length-o)throw new Error(s+` update.rank != ${n+r.length-o}`);for(let a=0;a<n;++a)if(e.shape[a]!==t.shape[a])throw new Error(s+` updates.shape[${a}] (${e.shape[a]}) != indices.shape[${a}] (${t.shape[a]}).`);for(let a=0;a<e.rank-n;++a)if(e.shape[a+n]!==r[a+o])throw new Error(s+` updates.shape[${a+n}] (${e.shape[a+n]}) != shape[${a+n}] (${r[a+n]})`)}function Uu(r,t,e){if(t.rank<1)throw new Error(`tf.scatterND() expects the indices to be rank 1 or higher, but the rank was ${t.rank}.`);if(r.rank<1)throw new Error(`tf.scatterND() expects the updates to be rank 1 or higher, but the rank was ${r.rank}.`);if(t.dtype!=="int32")throw new Error(`The dtype of 'indices' should be int32, but got dtype: ${t.dtype}`);if(e.length<1)throw new Error(`Output rank must be greater or equal to 1, but got shape: ${e}`);if(e.length===0){if(t.size===0)throw new Error(`Indices specified for empty output. indices shape: ${t.shape}`);if(r.size===0)throw new Error(`Updates specified for empty output. updates shape: ${r.shape}`)}K1(e,t,r)}function u6(r,t,e){let o=t.shape.length,n=o>1?t.shape[o-1]:1,s=e.length,a=1;for(let p=n;p<s;++p)a*=e[p];let i=n<1?1:n,c=$t(t.shape)/i,l=[...Ao(e.slice(0,n)),1],u=$t(e);return{sliceRank:n,numUpdates:c,sliceSize:a,strides:l,outputSize:u}}var kf=h(()=>{X()});function p6(r,t,e){let o=C(r,"tensor","tensorScatterupdate"),n=C(t,"indices","tensorScatterupdate","int32"),s=C(e,"updates","tensorScatterupdate");if(Uu(s,n,o.shape),o.dtype!==s.dtype)throw new Error(`tensor and updates must have the same dtype, instead they are ${o.dtype} and ${s.dtype}.`);let a={tensor:o,indices:n,updates:s},i={};return E.runKernel(Cc,a,i)}var X1,j1=h(()=>{B();H();P();F();kf();X1=T({tensorScatterUpdate_:p6})});function m6(r,t=1,e=!0){let o=C(r,"x","topk");if(o.rank===0)throw new Error("topk() expects the input to be of rank 1 or higher");let n=o.shape[o.shape.length-1];if(t<0)throw new Error(`'k' passed to topk() must be >= 0 but got ${t}`);if(t>n)throw new Error(`'k' passed to topk() must be <= the last dimension (${n}) but got ${t}`);let s={x:o},a={k:t,sorted:e},[i,c]=E.runKernel(Mc,s,a);return{values:i,indices:c}}var Y1,Z1=h(()=>{B();H();P();F();Y1=T({topk_:m6})});function f6(r,t=0,e=1,o,n){if(oe(r),o!=null&&o==="bool")throw new Error("Unsupported data type $ { dtype }");let s=new Ra(t,e,o,!0,n),a=ut(r,o);for(let i=0;i<a.values.length;i++)a.values[i]=s.nextValue();return a.toTensor()}var Q1,J1=h(()=>{Re();sn();F();Lu();Q1=T({truncatedNormal_:f6})});function d6(r,t=0){let e=C(r,"x","unique","string_or_numeric");$(e.rank>0,()=>"The input tensor must be at least 1D");let o={x:e},n={axis:t},[s,a]=E.runKernel(Vc,o,n);return{values:s,indices:a}}var tI,eI=h(()=>{B();H();P();X();F();tI=T({unique_:d6})});function h6(r,t,e){let o=C(r,"x","unsortedSegmentSum"),n=C(t,"segmentIds","unsortedSegmentSum","int32");$(Jo(e),()=>"numSegments must be of dtype int");let s={x:o,segmentIds:n},a={numSegments:e};return E.runKernel(Gc,s,a)}var rI,oI=h(()=>{B();H();P();X();F();rI=T({unsortedSegmentSum_:h6})});function g6(r,t=0){let e=C(r,"x","unstack","string_or_numeric");$(t>=-e.shape.length&&t<e.shape.length,()=>`Axis = ${t} is not in [-${e.shape.length}, ${e.shape.length})`);let o={value:e},n={axis:t};return E.runKernel(zc,o,n)}var Yr,Ef=h(()=>{B();H();P();X();F();Yr=T({unstack_:g6})});function nI(r,t){return Fu(r,t,"right")}var sI=h(()=>{Qm();});function aI(r,t=!0,e,o){return E.makeVariable(r,t,e,o)}var iI=h(()=>{B();});function $f(r,t){let e=[];for(let s=0;s<t.length;s++)t[s]&&e.push(s);let o=ut(r,"int32"),n=ut([e.length,r.length],"int32");for(let s=0;s<e.length;s++){let a=o.indexToLoc(e[s]),i=s*r.length;n.values.set(a,i)}return n.toTensor()}var Ry=h(()=>{sn();});async function x6(r){let t=C(r,"condition","whereAsync","bool"),e=await t.data(),o=$f(t.shape,e);return r!==t&&t.dispose(),o}var Rf,Ay=h(()=>{Ry();P();Rf=x6});async function y6(r,t,e){let o=C(r,"tensor","boolMask"),n=C(t,"mask","boolMask","bool"),s=e==null?0:e,a=n.rank,i=o.shape;$(a>0,()=>"mask cannot be scalar"),fe(i.slice(s,s+a),n.shape,"mask's shape must match the first K dimensions of tensor's shape,");let c=1;for(let x=s;x<s+a;x++)c*=i[x];let l=i.slice(0,s).concat([c],i.slice(s+a)),u=z(o,l),p=z(n,[-1]),m=await Rf(p),f=Da(m,[1]),d=Mm(u,f,s);return r!==o&&o.dispose(),t!==n&&n.dispose(),f.dispose(),u.dispose(),p.dispose(),m.dispose(),d}var b6,cI=h(()=>{P();X();ry();Et();Sf();Ay();b6=y6});function v6(r,t,e){let o=C(r,"x","transpose");if(t==null&&(t=o.shape.map((a,i)=>i).reverse()),$(o.rank===t.length,()=>`Error in transpose: rank of input ${o.rank} must match length of perm ${t}.`),t.forEach(a=>{$(a>=0&&a<o.rank,()=>`All entries in 'perm' must be between 0 and ${o.rank-1} but got ${t}`)}),o.rank<=1)return o.clone();let n={x:o},s={perm:t};return o.dtype==="complex64"?Tt(()=>{let a=fn(o),i=Kn(o);return a=E.runKernel(An,{x:a},s),i=E.runKernel(An,{x:i},s),e&&(i=Xe(i)),mr(a,i)}):E.runKernel(An,n,s)}var Af,_y=h(()=>{B();Ar();H();P();X();On();$u();mn();F();Mu();Af=T({transpose_:v6})});function w6(r,t,e,o,n=!0){let s=C(r,"v","movingAverage"),a=C(t,"x","movingAverage"),i=C(e,"decay","movingAverage");lC(s,a),$(Er(s.shape,a.shape),()=>"Shape mismatch in v and x");let c=bt(1),l=vt(c,i),u=tt(vt(a,s),l);if(n){$(o!=null,()=>"When using zeroDebias: true, step is required.");let p=C(o,"step","movingAverage");u=Dt(u,vt(c,ln(i,p)))}return mt(s,u)}var C6,lI=h(()=>{me();P();X();Ie();hr();ae();F();Iu();nr();De();C6=T({movingAverage_:w6})});function S6(r,t,e){oe(e);let o=C(r,"indices","scatterND","int32"),n=C(t,"updates","scatterND");Uu(n,o,e);let s={indices:o,updates:n},a={shape:e};return E.runKernel(wc,s,a)}var N6,uI=h(()=>{B();H();P();Re();F();kf();N6=T({scatterND_:S6})});function pI(r,t,e,o){if(r.dtype!=="int32")throw new Error(`tf.sparseToDense() expects the indices to be int32 type, but the dtype was ${r.dtype}.`);if(r.rank>2)throw new Error(`sparseIndices should be a scalar, vector, or matrix, but got shape ${r.shape}.`);let n=r.rank>0?r.shape[0]:1,s=r.rank>1?r.shape[1]:1;if(e.length!==s)throw new Error(`outputShape has incorrect number of elements:, ${e.length}, should be: ${s}.`);let a=t.size;if(!(t.rank===0||t.rank===1&&a===n))throw new Error(`sparseValues has incorrect shape ${t.shape}, should be [] or [${n}]`);if(t.dtype!==o.dtype)throw new Error("sparseValues.dtype must match defaultValues.dtype")}var mI=h(()=>{});function I6(r,t,e,o=0){oe(e);let n=C(r,"sparseIndices","sparseToDense","int32"),s=C(t,"sparseValues","sparseToDense","string_or_numeric"),a=C(o,"defaultValue","sparseToDense",s.dtype);pI(n,s,e,a);let i={sparseIndices:n,sparseValues:s,defaultValue:a},c={outputShape:e};return E.runKernel(Dc,i,c)}var k6,fI=h(()=>{B();H();mI();P();Re();F();k6=T({sparseToDense_:I6})});function E6(r,t){let e=C(t,"indices","gatherND","int32"),n={params:C(r,"x","gatherND","string_or_numeric"),indices:e};return E.runKernel(Ki,n)}var $6,dI=h(()=>{B();H();P();F();$6=T({gatherND_:E6})});function hI(r,t){if(t==null)return r.shape.slice();if(Er(r.shape,t))return t;if(r.shape.length===t.length){let e=[];for(let o=0;o<r.shape.length;o++)t[o]==null&&r.shape[o]!=null?e.push(r.shape[o]):e.push(t[o]);return e}return t}var gI=h(()=>{X();});function R6(r,t,e,o){let n=C(r,"x","dropout");if($(n.dtype==="float32",()=>`x has to be a floating point tensor since it's going to be scaled, but got a ${n.dtype} tensor instead.`),$(t>=0&&t<1,()=>`rate must be a float in the range [0, 1), but got ${t}.`),t===0)return r instanceof ee?n.clone():n;let s=hI(n,e),a=1-t,i=Dt(Lm(mt(fl(s,0,1,"float32",o),a)),a);return tt(n,i)}var A6,xI=h(()=>{Kr();P();X();Ie();hr();gI();ey();ae();F();ff();A6=T({dropout_:R6})});function Dy(r){return Math.floor(Math.pow(2,Math.ceil(Math.log(r)/Math.log(2))))}function Hu(r,t,e){let o=1-r%2,n=new Float32Array(r);for(let s=0;s<r;++s){let a=2*Math.PI*s/(r+o-1);n[s]=t-e*Math.cos(a)}return ze(n,"float32")}var Ku=h(()=>{Yn();});async function _6(r,t,e=1){let o=C(r,"predictions","inTopK"),n=C(t,"targets","inTopK");$(o.rank>1,()=>`inTopK() expects the predictions to be of rank 2 or higher, but got ${o.rank}`),$(o.rank-1===n.rank,()=>`predictions rank should be 1 larger than targets rank, but got predictions rank ${o.rank} and targets rank ${n.rank}`),fe(o.shape.slice(0,o.shape.length-1),n.shape,"predictions's shape should be align with the targets' shape, except the last dimension.");let s=o.shape[o.shape.length-1];$(e>0&&e<=s,()=>`'k' passed to inTopK() must be > 0 && <= the predictions last dimension (${s}), but got ${e}`);let a=await o.data(),i=await n.data(),[c,l]=[a.length/s,s],u=qg("bool",c);for(let p=0;p<c;p++){let m=p*l,f=a.subarray(m,m+l),d=[];for(let x=0;x<f.length;x++)d.push({value:f[x],index:x});d.sort((x,g)=>g.value-x.value),u[p]=0;for(let x=0;x<e;x++)if(d[x].index===i[p]){u[p]=1;break}}return r!==o&&o.dispose(),t!==n&&n.dispose(),ir(u,n.shape,"bool")}var D6,yI=h(()=>{P();X();lu();D6=_6});function F6(r,t,e,o,n,s="NHWC",a){let i=r;r.rank===3&&(i=z(r,[1,r.shape[0],r.shape[1],r.shape[2]]));let c=t;c.rank===3&&(c=z(t,[1,t.shape[0],t.shape[1],t.shape[2]])),$(i.rank===4,()=>`Error in conv2dDerFilter: input must be rank 4, but got shape ${i.shape}.`),$(c.rank===4,()=>`Error in conv2dDerFilter: dy must be rank 4, but got shape ${c.shape}.`),$(e.length===4,()=>`Error in conv2dDerFilter: filterShape must be length 4, but got ${e}.`);let l=s==="NHWC"?i.shape[3]:i.shape[1],u=s==="NHWC"?c.shape[3]:c.shape[1];$(l===e[2],()=>`Error in conv2dDerFilter: depth of input ${l}) must match input depth in filter (${e[2]}.`),$(u===e[3],()=>`Error in conv2dDerFilter: depth of dy (${u}) must match output depth for filter (${e[3]}).`),ve("conv2dDerFilter",n,a);let p={x:i,dy:c},m={strides:o,pad:n,dataFormat:s,dimRoundingMode:a,filterShape:e};return E.runKernel(Ii,p,m)}var bI,vI=h(()=>{B();H();X();gr();F();Et();bI=T({conv2DBackpropFilter_:F6})});function Fa(r,t,e){if(e==null||e==="linear")return r;if(e==="relu")return tt(r,Nf(t));throw new Error(`Cannot compute gradient for fused activation ${e}.`)}function Oa(r,t){let e=t,o=Em(r.shape,t.shape);return o.length>0&&(e=Gt(e,o)),z(e,r.shape)}function Pa(r,t,e,o){if(t==="linear")return r;if(t==="relu")return jn(r);if(t==="elu")return Rm(r);if(t==="relu6")return hf(r);if(t==="prelu")return af(r,e);if(t==="leakyrelu")return zm(r,o);if(t==="sigmoid")return bo(r);throw new Error(`Unknown fused activation ${t}.`)}var La,gl=h(()=>{_e();Zx();ny();ae();hy();Bu();Ny();Et();gu();Ey();vo();La=(r,t)=>!(r>0)||t==="linear"});function O6({x:r,filter:t,strides:e,pad:o,dataFormat:n="NHWC",dilations:s=[1,1],dimRoundingMode:a,bias:i,activation:c="linear",preluActivationWeights:l,leakyreluAlpha:u}){if(c=c||"linear",La(E.state.gradientDepth,c)===!1){$(n==="NHWC",()=>`Error in fused conv2d: got dataFormat of ${n} but only NHWC is currently supported for the case of gradient depth is 0 and the activation is not linear.`);let A=Wn(r,t,e,o,n,s,a);return i!=null&&(A=mt(A,i)),Pa(A,c,l,u)}let p=C(r,"x","conv2d","float32"),m=C(t,"filter","conv2d","float32"),f=p,d=!1;p.rank===3&&(d=!0,f=z(p,[1,p.shape[0],p.shape[1],p.shape[2]])),$(f.rank===4,()=>`Error in fused conv2d: input must be rank 4, but got rank ${f.rank}.`),$(m.rank===4,()=>`Error in fused conv2d: filter must be rank 4, but got rank ${m.rank}.`),ve("fused conv2d",o,a);let x=n==="NHWC"?f.shape[3]:f.shape[1];$(m.shape[2]===x,()=>`Error in conv2d: depth of input (${x}) must match input depth for filter ${m.shape[2]}.`),$(or(e,s),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`);let g=Sa(f.shape,m.shape,e,s,o,a),y;i!=null&&(y=C(i,"bias","fused conv2d"),[y]=kt(y,p),n==="NHWC"?Vt(g.outShape,y.shape):($(y.shape.length<=1,()=>`Error in fused conv2d: only supports scalar or 1-D Tensor bias for NCHW format but got the bias of rank-${y.shape.length}.`),$(y.shape.length===0||y.shape[0]===g.outChannels||y.shape[0]===1,()=>`Error in fused conv2d: bias shape (${y.shape}) is not compatible with the number of output channels (${g.outChannels})`)));let v;if(l!=null){let A=l.shape;if($(A.length<=1||A.length===3,()=>`Error in fused conv2d: only supports scalar, 1-D Tensor or 3-D Tensor PReLU activation weights but got a tensor of rank-${A.length}.`),A.length===1)$(A[0]===1||A[0]===g.outChannels,()=>`Error in fused conv2d: PReLU activation weights (${A}) is not compatible with the number of output channels (${g.outChannels}).`);else if(A.length===3)try{Vt(A,g.outShape)}catch{let D=`Error in fused conv2d: PReLU activation weights (${A}) is not compatible with the output shape of the conv2d (${g.outShape}).`;throw Error(D)}v=C(l,"prelu weights","fused conv2d")}let N=(A,_)=>{$(n==="NHWC",()=>`Error in gradient of fused conv2D: got dataFormat of ${n} but only NHWC is currently supported.`);let[D,L,M,V]=_,W=Fa(A,M,c);$(Ca(s),()=>`Error in gradient of fused conv2D: dilation rates greater than 1 are not yet supported in gradients. Got dilations '${s}'`);let G=Im(L.shape,W,D,e,o),K=bI(L,W,D.shape,e,o),U=[G,K];if(V!=null){let j=Oa(V,W);U.push(j)}return U},S={x:f,filter:m,bias:y,preluActivationWeights:v},R={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:a,activation:c,leakyreluAlpha:u};return i==null?yr((_,D,L)=>{let M=E.runKernel(ca,S,R);return L([D,_,M]),d&&(M=z(M,[M.shape[1],M.shape[2],M.shape[3]])),{value:M,gradFunc:N}})(f,m):yr((_,D,L,M)=>{let V=E.runKernel(ca,S,R);return M([D,_,V,L]),d&&(V=z(V,[V.shape[1],V.shape[2],V.shape[3]])),{value:V,gradFunc:N}})(f,m,y)}var wI,CI=h(()=>{B();qn();H();me();P();X();Ie();_e();bu();vI();Xx();gr();gl();F();Et();wI=T({fusedConv2d_:O6})});function P6(r,t,e,o,n,s=[1,1],a){let i=r;r.rank===3&&(i=z(r,[1,r.shape[0],r.shape[1],r.shape[2]]));let c=t;c.rank===3&&(c=z(t,[1,t.shape[0],t.shape[1],t.shape[2]]));let l={x:i,dy:c},u={strides:o,pad:n,dimRoundingMode:a,dilations:s,filterShape:e};return E.runKernel(Pi,l,u)}var SI,NI=h(()=>{B();H();F();Et();SI=T({depthwiseConv2dNativeBackpropFilter_:P6})});function L6(r,t,e,o,n,s=[1,1],a){let i=t,c=!1;t.rank===3&&(c=!0,i=z(t,[1,t.shape[0],t.shape[1],t.shape[2]]));let l={dy:i,filter:e},u={strides:o,pad:n,dimRoundingMode:a,dilations:s,inputShape:r},p=E.runKernel(Li,l,u);return c?z(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var TI,II=h(()=>{B();H();F();Et();TI=T({depthwiseConv2dNativeBackpropInput_:L6})});function M6({x:r,filter:t,strides:e,pad:o,dataFormat:n="NHWC",dilations:s=[1,1],dimRoundingMode:a,bias:i,activation:c="linear",preluActivationWeights:l,leakyreluAlpha:u}){if(La(E.state.gradientDepth,c)===!1){let R=al(r,t,e,o,n,s,a);return i!=null&&(R=mt(R,i)),Pa(R,c,l,u)}let p=C(r,"x","depthwiseConv2d","float32"),m=C(t,"filter","depthwiseConv2d","float32"),f=p,d=!1;p.rank===3&&(d=!0,f=z(p,[1,p.shape[0],p.shape[1],p.shape[2]])),$(f.rank===4,()=>`Error in fused depthwiseConv2d: input must be rank 4, but got rank ${f.rank}.`),$(m.rank===4,()=>`Error in fused depthwiseConv2d: filter must be rank 4, but got rank ${m.rank}.`),$(f.shape[3]===m.shape[2],()=>`Error in fused depthwiseConv2d: number of input channels (${f.shape[3]}) must match the inChannels dimension in filter ${m.shape[2]}.`),s==null&&(s=[1,1]),$(or(e,s),()=>`Error in fused depthwiseConv2d: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),ve("fused depthwiseConv2d",o,a);let x=Sa(f.shape,m.shape,e,s,o,a,!0),g;i!=null&&(g=C(i,"bias","fused conv2d"),[g]=kt(g,p),Vt(x.outShape,g.shape));let y;l!=null&&(y=C(l,"prelu weights","fused depthwiseConv2d"));let v=(R,A)=>{$(Ca(s),()=>`Error in gradient of fused depthwiseConv2d: dilation rates greater than 1 are not yet supported. Got dilations '${s}'`);let[_,D,L,M]=A,V=Fa(R,L,c),W=TI(D.shape,V,_,e,o,s,a),G=SI(D,V,_.shape,e,o,s,a);if(M!=null){let K=Oa(g,V);return[W,G,K]}return[W,G]},N={x:f,filter:m,bias:g,preluActivationWeights:y},S={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:a,activation:c,leakyreluAlpha:u};return i==null?yr((A,_,D)=>{let L=E.runKernel(la,N,S);return D([_,A,L]),d&&(L=z(L,[L.shape[1],L.shape[2],L.shape[3]])),{value:L,gradFunc:v}})(f,m):yr((A,_,D,L)=>{let M=E.runKernel(la,N,S);return L([_,A,M,D]),d&&(M=z(M,[M.shape[1],M.shape[2],M.shape[3]])),{value:M,gradFunc:v}})(f,m,g)}var kI,EI=h(()=>{B();qn();H();me();P();X();Ie();_e();gr();km();NI();II();gl();F();Et();kI=T({fusedDepthwiseConv2d_:M6})});function B6({a:r,b:t,transposeA:e=!1,transposeB:o=!1,bias:n,activation:s="linear",preluActivationWeights:a,leakyreluAlpha:i=.2}){if(La(E.state.gradientDepth,s)===!1){let V=zt(r,t,e,o);return n!=null&&(V=mt(V,n)),Pa(V,s,a,i)}let c=C(r,"a","fused matMul"),l=C(t,"b","fused matMul");[c,l]=kt(c,l);let u=e?c.shape[c.rank-2]:c.shape[c.rank-1],p=o?l.shape[l.rank-1]:l.shape[l.rank-2],m=e?c.shape[c.rank-1]:c.shape[c.rank-2],f=o?l.shape[l.rank-2]:l.shape[l.rank-1],d=c.shape.slice(0,-2),x=l.shape.slice(0,-2),g=$t(d),y=$t(x);$(u===p,()=>`Error in fused matMul: inner shapes (${u}) and (${p}) of Tensors with shapes ${c.shape} and ${l.shape} and transposeA=${e} and transposeB=${o} must match.`);let N=Vt(c.shape.slice(0,-2),l.shape.slice(0,-2)).concat([m,f]),S=e?z(c,[g,u,m]):z(c,[g,m,u]),R=o?z(l,[y,f,p]):z(l,[y,p,f]),A;n!=null&&(A=C(n,"bias","fused matMul"),[A]=kt(A,c),Vt(N,A.shape));let _;a!=null&&(_=C(a,"prelu weights","fused matMul"));let D=(V,W)=>{let[G,K,U,j]=W,Z=Fa(z(V,U.shape),U,s),q,Q;if(!e&&!o?(q=zt(Z,K,!1,!0),Q=zt(G,Z,!0,!1)):!e&&o?(q=zt(Z,K,!1,!1),Q=zt(Z,G,!0,!1)):e&&!o?(q=zt(K,Z,!1,!0),Q=zt(G,Z,!1,!1)):(q=zt(K,Z,!0,!0),Q=zt(Z,G,!0,!0)),n!=null){let rt=Oa(j,Z);return[q,Q,rt]}else return[q,Q]},L={a:S,b:R,bias:A,preluActivationWeights:_},M={transposeA:e,transposeB:o,activation:s,leakyreluAlpha:i};return n==null?yr((W,G,K)=>{let U=E.runKernel(ia,L,M);return K([W,G,U]),{value:z(U,N),gradFunc:D}})(S,R):yr((W,G,K,U)=>{let j=E.runKernel(ia,L,M);return U([W,G,j,K]),{value:z(j,N),gradFunc:D}})(S,R,A)}var $I,RI=h(()=>{B();qn();H();me();P();X();Ie();_e();gl();Vn();F();Et();$I=T({fusedMatMul_:B6})});var Fy={};Yt(Fy,{conv2d:()=>wI,depthwiseConv2d:()=>kI,matMul:()=>$I});var AI=h(()=>{CI();EI();RI();});function V6(r){return Hu(r,.54,.46)}var _I,DI=h(()=>{F();Ku();_I=T({hammingWindow_:V6})});function z6(r){return Hu(r,.5,.5)}var _f,Oy=h(()=>{F();Ku();_f=T({hannWindow_:z6})});function G6(r,t,e,o=!1,n=0){let s=0,a=[];for(;s+t<=r.size;)a.push(Ft(r,s,t)),s+=e;if(o)for(;s<r.size;){let i=s+t-r.size,c=Jt([Ft(r,s,t-i),Lo([i],n)]);a.push(c),s+=e}return a.length===0?hn([],[0,t]):z(Jt(a),[a.length,t])}var Df,Py=h(()=>{yo();sl();F();Et();oo();Tf();Df=T({frame_:G6})});function W6(r,t,e,o,n=_f){o==null&&(o=Dy(t));let s=Df(r,t,e),a=tt(s,n(t));return hl(a,o)}var FI,OI=h(()=>{ae();F();Ku();wf();Py();Oy();FI=T({stft_:W6})});function U6(r,t,e,o,n="bilinear",s=0){let a=C(r,"image","cropAndResize"),i=C(t,"boxes","cropAndResize","float32"),c=C(e,"boxInd","cropAndResize","int32"),l=i.shape[0];$(a.rank===4,()=>`Error in cropAndResize: image must be rank 4,but got rank ${a.rank}.`),$(i.rank===2&&i.shape[1]===4,()=>`Error in cropAndResize: boxes must be have size [${l},4] but had shape ${i.shape}.`),$(c.rank===1&&c.shape[0]===l,()=>`Error in cropAndResize: boxInd must be have size [${l}] but had shape ${i.shape}.`),$(o.length===2,()=>`Error in cropAndResize: cropSize must be of length 2, but got length ${o.length}.`),$(o[0]>=1&&o[1]>=1,()=>`cropSize must be atleast [1,1], but was ${o}`),$(n==="bilinear"||n==="nearest",()=>`method must be bilinear or nearest, but was ${n}`);let u={image:a,boxes:i,boxInd:c},p={method:n,extrapolationValue:s,cropSize:o};return E.runKernel(_i,u,p)}var PI,LI=h(()=>{B();H();P();X();F();PI=T({cropAndResize_:U6})});function H6(r){let t=C(r,"image","flipLeftRight","float32");$(t.rank===4,()=>`Error in flipLeftRight: image must be rank 4,but got rank ${t.rank}.`);let e={image:t};return E.runKernel(Wi,e,{})}var MI,BI=h(()=>{B();H();P();X();F();MI=T({flipLeftRight_:H6})});function K6(r){let t=C(r,"image","grayscaleToRGB"),e=t.rank-1,o=t.shape[e];$(t.rank>=2,()=>`Error in grayscaleToRGB: images must be at least rank 2, but got rank ${t.rank}.`),$(o===1,()=>`Error in grayscaleToRGB: last dimension of a grayscale image should be size 1, but got size ${o}.`);let n=new Array(t.rank);return n.fill(1,0,e),n[e]=3,Hn(t,n)}var VI,zI=h(()=>{P();X();F();Om();VI=T({grayscaleToRGB_:K6})});function q6(r){let t=C(r,"image","RGBToGrayscale"),e=t.rank-1,o=t.shape[e];$(t.rank>=2,()=>`Error in RGBToGrayscale: images must be at least rank 2, but got rank ${t.rank}.`),$(o===3,()=>`Error in RGBToGrayscale: last dimension of an RGB image should be size 3, but got size ${o}.`);let n=t.dtype,s=_t(t,"float32"),a=ze([.2989,.587,.114]),i;switch(t.rank){case 2:i=Un("ij,j->i",s,a);break;case 3:i=Un("ijk,k->ij",s,a);break;case 4:i=Un("ijkl,l->ijk",s,a);break;case 5:i=Un("ijklm,m->ijkl",s,a);break;case 6:i=Un("ijklmn,n->ijklm",s,a);break;default:throw new Error("Not a valid tensor rank.")}return i=_r(i,-1),_t(i,n)}var GI,WI=h(()=>{P();X();rr();Yx();Fm();F();Yn();GI=T({rgbToGrayscale_:q6})});function X6(r,t,e=0,o=.5){let n=C(r,"image","rotateWithOffset","float32");$(n.rank===4,()=>`Error in rotateWithOffset: image must be rank 4,but got rank ${n.rank}.`);let s={image:n},a={radians:t,fillValue:e,center:o};return E.runKernel(Uc,s,a)}var UI,HI=h(()=>{B();H();P();X();F();UI=T({rotateWithOffset_:X6})});function so(r,t,e,o,n,s){o==null&&(o=.5),n==null&&(n=Number.NEGATIVE_INFINITY),s==null&&(s=0);let a=r.shape[0];return e=Math.min(e,a),$(0<=o&&o<=1,()=>`iouThreshold must be in [0, 1], but was '${o}'`),$(r.rank===2,()=>`boxes must be a 2D tensor, but was of rank '${r.rank}'`),$(r.shape[1]===4,()=>`boxes must have 4 columns, but 2nd dimension was ${r.shape[1]}`),$(t.rank===1,()=>"scores must be a 1D tensor"),$(t.shape[0]===a,()=>`scores has incompatible shape with boxes. Expected ${a}, but was ${t.shape[0]}`),$(0<=s&&s<=1,()=>`softNmsSigma must be in [0, 1], but was '${s}'`),{maxOutputSize:e,iouThreshold:o,scoreThreshold:n,softNmsSigma:s}}var Ma=h(()=>{X();});function j6(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY){let s=C(r,"boxes","nonMaxSuppression","float32"),a=C(t,"scores","nonMaxSuppression","float32"),i=so(s,a,e,o,n);e=i.maxOutputSize,o=i.iouThreshold,n=i.scoreThreshold;let c={maxOutputSize:e,iouThreshold:o,scoreThreshold:n};return E.runKernel(oc,{boxes:s,scores:a},c)}var KI,qI=h(()=>{B();H();P();Ma();F();KI=T({nonMaxSuppression_:j6})});function XI(r,t,e){let o=Y6(r,t,e),n=o<0?-(o+1):o;r.splice(n,0,t)}function Y6(r,t,e){return Q6(r,t,e||Z6)}function Z6(r,t){return r>t?1:r<t?-1:0}function Q6(r,t,e){let o=0,n=r.length,s=0,a=!1;for(;o<n;){s=o+(n-o>>>1);let i=e(t,r[s]);i>0?o=s+1:(n=s,a=!i)}return a?o:-o-1}var jI=h(()=>{});function Ff(r,t,e,o,n){return Ly(r,t,e,o,n,0)}function Of(r,t,e,o,n,s){return Ly(r,t,e,o,n,0,!1,s,!0)}function Pf(r,t,e,o,n,s){return Ly(r,t,e,o,n,s,!0)}function Ly(r,t,e,o,n,s,a=!1,i=!1,c=!1){let l=[];for(let g=0;g<t.length;g++)t[g]>n&&l.push({score:t[g],boxIndex:g,suppressBeginIndex:0});l.sort(YI);let u=s>0?-.5/s:0,p=[],m=[];for(;p.length<e&&l.length>0;){let g=l.pop(),{score:y,boxIndex:v,suppressBeginIndex:N}=g;if(y<n)break;let S=!1;for(let R=p.length-1;R>=N;--R){let A=J6(r,v,p[R]);if(A>=o){S=!0;break}if(g.score=g.score*tX(o,u,A),g.score<=n)break}g.suppressBeginIndex=p.length,S||(g.score===y?(p.push(v),m.push(g.score)):g.score>n&&XI(l,g,YI))}let f=p.length,d=e-f;i&&d>0&&(p.push(...new Array(d).fill(0)),m.push(...new Array(d).fill(0)));let x={selectedIndices:p};return a&&(x.selectedScores=m),c&&(x.validOutputs=f),x}function J6(r,t,e){let o=r.subarray(t*4,t*4+4),n=r.subarray(e*4,e*4+4),s=Math.min(o[0],o[2]),a=Math.min(o[1],o[3]),i=Math.max(o[0],o[2]),c=Math.max(o[1],o[3]),l=Math.min(n[0],n[2]),u=Math.min(n[1],n[3]),p=Math.max(n[0],n[2]),m=Math.max(n[1],n[3]),f=(i-s)*(c-a),d=(p-l)*(m-u);if(f<=0||d<=0)return 0;let x=Math.max(s,l),g=Math.max(a,u),y=Math.min(i,p),v=Math.min(c,m),N=Math.max(y-x,0)*Math.max(v-g,0);return N/(f+d-N)}function tX(r,t,e){let o=Math.exp(t*e*e);return e<=r?o:0}function YI(r,t){return r.score-t.score||r.score===t.score&&t.boxIndex-r.boxIndex}var qu=h(()=>{jI();});async function eX(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY){let s=C(r,"boxes","nonMaxSuppressionAsync"),a=C(t,"scores","nonMaxSuppressionAsync"),i=so(s,a,e,o,n);e=i.maxOutputSize,o=i.iouThreshold,n=i.scoreThreshold;let c=await Promise.all([s.data(),a.data()]),l=c[0],u=c[1],{selectedIndices:p}=Ff(l,u,e,o,n);return s!==r&&s.dispose(),a!==t&&a.dispose(),ze(p,"int32")}var ZI,QI=h(()=>{qu();P();Ma();Yn();ZI=eX});function rX(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=0){let a=C(r,"boxes","nonMaxSuppression"),i=C(t,"scores","nonMaxSuppression"),c=so(a,i,e,o,n,s);e=c.maxOutputSize,o=c.iouThreshold,n=c.scoreThreshold,s=c.softNmsSigma;let l={boxes:a,scores:i},u={maxOutputSize:e,iouThreshold:o,scoreThreshold:n,softNmsSigma:s},p=E.runKernel(sc,l,u);return{selectedIndices:p[0],selectedScores:p[1]}}var JI,tk=h(()=>{B();H();P();Ma();F();JI=T({nonMaxSuppressionWithScore_:rX})});async function oX(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=0){let a=C(r,"boxes","nonMaxSuppressionAsync"),i=C(t,"scores","nonMaxSuppressionAsync"),c=so(a,i,e,o,n,s);e=c.maxOutputSize,o=c.iouThreshold,n=c.scoreThreshold,s=c.softNmsSigma;let l=await Promise.all([a.data(),i.data()]),u=l[0],p=l[1],{selectedIndices:m,selectedScores:f}=Pf(u,p,e,o,n,s);return a!==r&&a.dispose(),i!==t&&i.dispose(),{selectedIndices:ze(m,"int32"),selectedScores:ze(f)}}var ek,rk=h(()=>{qu();P();Ma();Yn();ek=oX});function nX(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=!1){let a=C(r,"boxes","nonMaxSuppression"),i=C(t,"scores","nonMaxSuppression"),c=so(a,i,e,o,n,null),l=c.maxOutputSize,u=c.iouThreshold,p=c.scoreThreshold,m={boxes:a,scores:i},f={maxOutputSize:l,iouThreshold:u,scoreThreshold:p,padToMaxOutputSize:s},d=E.runKernel(nc,m,f);return{selectedIndices:d[0],validOutputs:d[1]}}var ok,nk=h(()=>{B();H();P();Ma();F();ok=T({nonMaxSuppressionPadded_:nX})});async function sX(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=!1){let a=C(r,"boxes","nonMaxSuppressionAsync"),i=C(t,"scores","nonMaxSuppressionAsync"),c=so(a,i,e,o,n,null),l=c.maxOutputSize,u=c.iouThreshold,p=c.scoreThreshold,[m,f]=await Promise.all([a.data(),i.data()]),{selectedIndices:d,validOutputs:x}=Of(m,f,l,u,p,s);return a!==r&&a.dispose(),i!==t&&i.dispose(),{selectedIndices:ze(d,"int32"),validOutputs:bt(x,"int32")}}var sk,ak=h(()=>{qu();P();Ma();nr();Yn();sk=sX});function aX(r,t,e=!1,o=!1){let n=C(r,"images","resizeBilinear");$(n.rank===3||n.rank===4,()=>`Error in resizeBilinear: x must be rank 3 or 4, but got rank ${n.rank}.`),$(t.length===2,()=>`Error in resizeBilinear: new shape must 2D, but got shape ${t}.`),$(o===!1||e===!1,()=>"Error in resizeBilinear: If halfPixelCenters is true, alignCorners must be false.");let s=n,a=!1;n.rank===3&&(a=!0,s=z(n,[1,n.shape[0],n.shape[1],n.shape[2]]));let[]=t,i={images:s},c={alignCorners:e,halfPixelCenters:o,size:t},l=E.runKernel(bc,i,c);return a?z(l,[l.shape[1],l.shape[2],l.shape[3]]):l}var ik,ck=h(()=>{B();H();P();X();F();Et();ik=T({resizeBilinear_:aX})});function iX(r,t,e=!1,o=!1){let n=C(r,"images","resizeNearestNeighbor");$(n.rank===3||n.rank===4,()=>`Error in resizeNearestNeighbor: x must be rank 3 or 4, but got rank ${n.rank}.`),$(t.length===2,()=>`Error in resizeNearestNeighbor: new shape must 2D, but got shape ${t}.`),$(n.dtype==="float32"||n.dtype==="int32",()=>"`images` must have `int32` or `float32` as dtype"),$(o===!1||e===!1,()=>"Error in resizeNearestNeighbor: If halfPixelCenters is true, alignCorners must be false.");let s=n,a=!1;n.rank===3&&(a=!0,s=z(n,[1,n.shape[0],n.shape[1],n.shape[2]]));let[]=t,i={images:s},c={alignCorners:e,halfPixelCenters:o,size:t},l=E.runKernel(yc,i,c);return a?z(l,[l.shape[1],l.shape[2],l.shape[3]]):l}var lk,uk=h(()=>{B();H();P();X();F();Et();lk=T({resizeNearestNeighbor_:iX})});function cX(r,t="binary",e=!1,o=.5){let n=C(r,"image","threshold"),s=.2989,a=.587,i=.114,c=n.shape[0]*n.shape[1],l=tt(ze([o]),255),u,p,m,f;if($(n.rank===3,()=>`Error in threshold: image must be rank 3,but got rank ${n.rank}.`),$(n.shape[2]===3||n.shape[2]===1,()=>`Error in threshold: image color channel must be equal to 3 or 1but got ${n.shape[2]}.`),$(n.dtype==="int32"||n.dtype==="float32",()=>`Error in dtype: image dtype must be int32 or float32,but got dtype ${n.dtype}.`),$(t==="otsu"||t==="binary",()=>`Method must be binary or otsu, but was ${t}`),n.shape[2]===3){[u,p,m]=dn(n,[1,1,1],-1);let g=tt(u,s),y=tt(p,a),v=tt(m,i);f=mt(mt(g,y),v)}else f=r;if(t==="otsu"){let g=Tm(_t(gf(f),"int32"),ir([]),256);l=lX(g,c)}let d=e?pl(f,l):Ta(f,l);return _t(tt(d,255),"int32")}function lX(r,t){let e=ze([-1]),o=ze([0]),n=ze([0]),s,a,i,c,l,u;for(let p=0;p<r.size-1;p++){s=Ft(r,0,p+1),a=Ft(r,p+1),l=Dt(Gt(s),t),u=Dt(Gt(a),t);let m=Gt(tt(s,Xn(0,s.size)));i=Dt(m,Gt(s));let f=Lo(a.shape,s.size),d=mt(Xn(0,a.size),f),x=tt(a,d);c=Dt(Gt(x),Gt(a));let g=vt(i,c),y=vt(i,c),v=tt(l,u);n=tt(tt(v,g),y);let N=Ta(n,o);o=qr(N,n,o),e=qr(N,ze([p]),e)}return e}var pk,mk=h(()=>{Yn();F();rr();zu();Kx();Gm();Bm();vo();Ie();ae();hr();De();Ty();il();sl();oo();df();lu();X();P();pk=T({threshold_:cX})});function uX(r,t,e="nearest",o="constant",n=0,s){let a=C(r,"image","transform","float32"),i=C(t,"transforms","transform","float32");$(a.rank===4,()=>`Error in transform: image must be rank 4,but got rank ${a.rank}.`),$(i.rank===2&&(i.shape[0]===a.shape[0]||i.shape[0]===1)&&i.shape[1]===8,()=>"Error in transform: Input transform should be batch x 8 or 1 x 8"),$(s==null||s.length===2,()=>`Error in transform: outputShape must be [height, width] or null, but got ${s}.`);let c={image:a,transforms:i},l={interpolation:e,fillMode:o,fillValue:n,outputShape:s};return E.runKernel(Bc,c,l)}var fk,dk=h(()=>{B();H();P();X();F();fk=T({transform_:uX})});function pX(r,t,e){let o=C(r,"a","bandPart");$(o.rank>=2,()=>`bandPart(): Rank must be at least 2, got ${o.rank}.`);let n=o.shape,[s,a]=o.shape.slice(-2),i,c;typeof t=="number"?($(t%1===0,()=>`bandPart(): numLower must be an integer, got ${t}.`),$(t<=s,()=>`bandPart(): numLower (${t}) must not be greater than the number of rows (${s}).`),i=C(t<0?s:t,"numLower","bandPart")):($(t.dtype==="int32",()=>"bandPart(): numLower's dtype must be an int32."),i=qr(Ru(t,0),s,Ea(t,s))),typeof e=="number"?($(e%1===0,()=>`bandPart(): numUpper must be an integer, got ${e}.`),$(e<=a,()=>`bandPart(): numUpper (${e}) must not be greater than the number of columns (${a}).`),c=C(e<0?a:e,"numUpper","bandPart")):($(e.dtype==="int32",()=>"bandPart(): numUpper's dtype must be an int32."),c=qr(Ru(e,0),a,Ea(e,a)));let l=z(Xn(0,s,1,"int32"),[-1,1]),u=Xn(0,a,1,"int32"),p=vt(l,u),m=Ia(pl(p,i),Vm(p,Xe(c))),f=Xr([s,a],o.dtype);return z(cr(Yr(z(o,[-1,s,a])).map(d=>qr(m,d,f))),n)}var hk,gk=h(()=>{P();X();oy();sy();Gm();Xm();of();mn();F();df();Et();Gu();De();Ef();il();Ou();hk=T({bandPart_:pX})});function mX(r){let t;if(Array.isArray(r)){t=!1,$(r!=null&&r.length>0,()=>"Gram-Schmidt process: input must not be null, undefined, or empty");let n=r[0].shape[0];for(let s=1;s<r.length;++s)$(r[s].shape[0]===n,()=>`Gram-Schmidt: Non-unique lengths found in the input vectors: (${r[s].shape[0]} vs. ${n})`)}else t=!0,r=dn(r,r.shape[0],0).map(n=>Da(n,[0]));$(r.length<=r[0].shape[0],()=>`Gram-Schmidt: Number of vectors (${r.length}) exceeds number of dimensions (${r[0].shape[0]}).`);let e=[],o=r;for(let n=0;n<r.length;++n)e.push(E.tidy(()=>{let s=o[n];if(n>0)for(let a=0;a<n;++a){let i=tt(Gt(tt(e[a],s)),e[a]);s=vt(s,i)}return Dt(s,Na(s,"euclidean"))}));return t?cr(e,0):e}var xk,yk=h(()=>{B();X();hr();ae();ku();F();zu();Sf();Gu();De();vo();xk=T({gramSchmidt_:mX})});function fX(r,t=!1){if($(r.rank>=2,()=>`qr() requires input tensor to have a rank >= 2, but got rank ${r.rank}`),r.rank===2)return bk(r,t);{let e=r.shape.slice(0,r.shape.length-2).reduce((c,l)=>c*l),o=Yr(z(r,[e,r.shape[r.shape.length-2],r.shape[r.shape.length-1]]),0),n=[],s=[];o.forEach(c=>{let[l,u]=bk(c,t);n.push(l),s.push(u)});let a=z(cr(n,0),r.shape),i=z(cr(s,0),r.shape);return[a,i]}}function bk(r,t=!1){return E.tidy(()=>{$(r.shape.length===2,()=>`qr2d() requires a 2D Tensor, but got a ${r.shape.length}D Tensor.`);let e=r.shape[0],o=r.shape[1],n=Pm(e),s=dr(r),a=hn([[1]],[1,1]),i=dr(a),c=e>=o?o:e;for(let l=0;l<c;++l){let u=s,p=i,m=n;[i,s,n]=E.tidy(()=>{let f=Ft(s,[l,l],[e-l,1]),d=Na(f),x=Ft(s,[l,l],[1,1]),g=qr(Ta(x,0),hn([[-1]]),hn([[1]])),y=vt(x,tt(g,d)),v=Dt(f,y);v.shape[0]===1?i=dr(a):i=Jt([a,Ft(v,[1,0],[v.shape[0]-1,v.shape[1]])],0);let N=Xe(Dt(zt(g,y),d)),S=Ft(s,[l,0],[e-l,o]),R=tt(N,i),A=Af(i);if(l===0)s=vt(S,zt(R,zt(A,S)));else{let L=vt(S,zt(R,zt(A,S)));s=Jt([Ft(s,[0,0],[l,o]),L],0)}let _=Af(R),D=Ft(n,[0,l],[e,n.shape[1]-l]);if(l===0)n=vt(D,zt(zt(D,i),_));else{let L=vt(D,zt(zt(D,i),_));n=Jt([Ft(n,[0,0],[e,l]),L],1)}return[i,s,n]}),se([u,p,m])}return!t&&e>o&&(n=Ft(n,[0,0],[e,o]),s=Ft(s,[0,0],[o,o])),[n,s]})}var vk,wk=h(()=>{B();Ar();X();ol();yo();hr();ty();Bm();Vn();ae();mn();ku();F();Et();oo();Gu();De();Tf();_y();Ef();il();vk=T({qr_:fX})});var ye,Go=h(()=>{(function(r){r[r.NONE=0]="NONE",r[r.MEAN=1]="MEAN",r[r.SUM=2]="SUM",r[r.SUM_BY_NONZERO_WEIGHTS=3]="SUM_BY_NONZERO_WEIGHTS"})(ye||(ye={}))});function dX(r,t,e=ye.SUM_BY_NONZERO_WEIGHTS){let o=C(r,"losses","computeWeightedLoss"),n=null;t!=null&&(n=C(t,"weights","computeWeightedLoss"));let s=n==null?o:tt(o,n);if(e===ye.NONE)return s;if(e===ye.SUM)return Gt(s);if(e===ye.MEAN){if(n==null)return ka(s);{let a=o.size/n.size,i=Dt(Gt(s),Gt(n));return a>1?Dt(i,bt(a)):i}}if(e===ye.SUM_BY_NONZERO_WEIGHTS){if(n==null)return Dt(Gt(s),bt(o.size));{let a=tt(n,Vo(o.shape)),i=_t(Gt(nf(a,bt(0))),"float32");return Dt(Gt(s),i)}}throw Error(`Unknown reduction: ${e}`)}var je,Wo=h(()=>{P();rr();hr();Go();ef();ae();fy();rf();F();nr();vo();je=T({computeWeightedLoss_:dX})});function hX(r,t,e,o=ye.SUM_BY_NONZERO_WEIGHTS){let n=C(r,"labels","absoluteDifference"),s=C(t,"predictions","absoluteDifference"),a=null;e!=null&&(a=C(e,"weights","absoluteDifference")),fe(n.shape,s.shape,"Error in absoluteDifference: ");let i=Be(vt(n,s));return je(i,a,o)}var Ck,Sk=h(()=>{P();X();wa();Go();F();De();Wo();Ck=T({absoluteDifference_:hX})});function gX(r,t,e,o,n=ye.SUM_BY_NONZERO_WEIGHTS){let s=C(r,"labels","cosineDistance"),a=C(t,"predictions","cosineDistance"),i=null;o!=null&&(i=C(o,"weights","cosineDistance")),fe(s.shape,a.shape,"Error in cosineDistance: ");let c=bt(1),l=vt(c,Gt(tt(s,a),e,!0));return je(l,i,n)}var Nk,Tk=h(()=>{P();X();Go();ae();F();nr();De();vo();Wo();Nk=T({cosineDistance_:gX})});function xX(r,t,e,o=ye.SUM_BY_NONZERO_WEIGHTS){let n=C(r,"labels","hingeLoss"),s=C(t,"predictions","hingeLoss"),a=null;e!=null&&(a=C(e,"weights","hingeLoss")),fe(n.shape,s.shape,"Error in hingeLoss: ");let i=bt(1);n=vt(tt(bt(2),n),i);let c=jn(vt(i,tt(n,s)));return je(c,a,o)}var Ik,kk=h(()=>{P();X();Go();ae();F();Bu();nr();De();Wo();Ik=T({hingeLoss_:xX})});function yX(r,t,e,o=1,n=ye.SUM_BY_NONZERO_WEIGHTS){let s=C(r,"labels","huberLoss"),a=C(t,"predictions","huberLoss"),i=null;e!=null&&(i=C(e,"weights","huberLoss")),fe(s.shape,a.shape,"Error in huberLoss: ");let c=bt(o),l=Be(vt(a,s)),u=Ea(l,c),p=vt(l,u),m=mt(tt(bt(.5),Ve(u)),tt(c,p));return je(m,i,n)}var Ek,$k=h(()=>{P();X();wa();Ie();Go();of();ae();F();nr();un();De();Wo();Ek=T({huberLoss_:yX})});function bX(r,t,e,o=1e-7,n=ye.SUM_BY_NONZERO_WEIGHTS){let s=C(r,"labels","logLoss"),a=C(t,"predictions","logLoss"),i=null;e!=null&&(i=C(e,"weights","logLoss")),fe(s.shape,a.shape,"Error in logLoss: ");let c=bt(1),l=bt(o),u=Xe(tt(s,pn(mt(a,l)))),p=tt(vt(c,s),pn(mt(vt(c,a),l))),m=vt(u,p);return je(m,i,n)}var Rk,Ak=h(()=>{P();X();Ie();_u();Go();ae();mn();F();nr();De();Wo();Rk=T({logLoss_:bX})});function vX(r,t,e,o=ye.SUM_BY_NONZERO_WEIGHTS){let n=C(r,"labels","meanSquaredError"),s=C(t,"predictions","meanSquaredError"),a=null;e!=null&&(a=C(e,"weights","meanSquaredError")),fe(n.shape,s.shape,"Error in meanSquaredError: ");let i=Cf(n,s);return je(i,a,o)}var _k,Dk=h(()=>{P();X();Go();F();ky();Wo();_k=T({meanSquaredError_:vX})});function wX(r,t){let e=C(r,"labels","sigmoidCrossEntropyWithLogits"),o=C(t,"logits","sigmoidCrossEntropyWithLogits");fe(e.shape,o.shape,"Error in sigmoidCrossEntropyWithLogits: ");let n=jn(o),s=tt(o,e),a=Um(no(Xe(Be(o))));return mt(vt(n,s),a)}function CX(r,t,e,o=0,n=ye.SUM_BY_NONZERO_WEIGHTS){let s=C(r,"multiClassLabels","sigmoidCrossEntropy"),a=C(t,"logits","sigmoidCrossEntropy"),i=null;if(e!=null&&(i=C(e,"weights","sigmoidCrossEntropy")),fe(s.shape,a.shape,"Error in sigmoidCrossEntropy: "),o>0){let l=bt(o),u=bt(1),p=bt(.5);s=mt(tt(s,vt(u,l)),tt(p,l))}let c=wX(s,a);return je(c,i,n)}var Fk,Ok=h(()=>{P();X();wa();Ie();ul();ay();Go();ae();mn();F();Bu();nr();De();Wo();Fk=T({sigmoidCrossEntropy_:CX})});function SX(r,t,e=-1){if(e===-1&&(e=t.rank-1),e!==t.rank-1)throw Error(`Softmax cross entropy along a non-last dimension is not yet supported. Labels / logits was rank ${t.rank} and dim was ${e}`);return yr((n,s,a)=>{let c=qm(s,[e],!0),l=vt(_t(s,"float32"),c);a([n,l]);let u=Xe(tt(l,n));return{value:Gt(u,[e]),gradFunc:(f,d)=>{let[x,g]=d,y=cn(f.shape,[e]);return[tt(z(f,y),vt(_t(x,"float32"),no(g))),tt(z(f,y),vt(no(g),_t(x,"float32")))]}}})(r,t)}function NX(r,t,e,o=0,n=ye.SUM_BY_NONZERO_WEIGHTS){let s=C(r,"onehotLabels","softmaxCrossEntropy"),a=C(t,"logits","softmaxCrossEntropy"),i=null;if(e!=null&&(i=C(e,"weights","softmaxCrossEntropy")),fe(s.shape,a.shape,"Error in softmaxCrossEntropy: "),o>0){let l=bt(o),u=bt(1),p=bt(s.shape[1]);s=mt(tt(s,vt(u,l)),Dt(l,p))}let c=SX(s,a);return je(c,i,n)}var Pk,Lk=h(()=>{qn();P();X();Ie();cl();rr();hr();ul();cy();Go();ae();mn();F();Et();nr();De();vo();Wo();Pk=T({softmaxCrossEntropy_:NX})});function TX(r,t,e,o){let n=C(r,"indices","sparseFillEmptyRows","int32"),s=C(t,"values","sparseFillEmptyRows"),a=C(e,"denseShape","sparseFillEmptyRows","int32"),i=C(o,"defaultValue","sparseFillEmptyRows",s.dtype);if(n.rank!==2)throw new Error(`Indices should be Tensor2D but received shape
        ${n.shape}`);if(s.rank!==1)throw new Error(`Values should be Tensor1D but received shape ${s.shape}`);if(a.rank!==1)throw new Error(`Dense shape should be Tensor1D but received shape ${a.shape}`);if(i.rank!==0)throw new Error(`Default value should be a scalar but received shape ${i.shape}`);let c={indices:n,values:s,denseShape:a,defaultValue:i},l=E.runKernel($c,c);return{outputIndices:l[0],outputValues:l[1],emptyRowIndicator:l[2],reverseIndexMap:l[3]}}var Mk,Bk=h(()=>{B();H();P();F();Mk=T({sparseFillEmptyRows_:TX})});function IX(r,t,e){let o=C(r,"inputIndices","sparseReshape","int32"),n=C(t,"inputShape","sparseReshape","int32"),s=C(e,"newShape","sparseReshape","int32");if(o.rank!==2)throw new Error(`Input indices should be Tensor2D but received shape
        ${o.shape}`);if(n.rank!==1)throw new Error(`Input shape should be Tensor1D but received shape ${n.shape}`);if(s.rank!==1)throw new Error(`New shape should be Tensor1D but received shape ${s.shape}`);let a={inputIndices:o,inputShape:n,newShape:s},i=E.runKernel(Rc,a);return{outputIndices:i[0],outputShape:i[1]}}var Vk,zk=h(()=>{B();H();P();F();Vk=T({sparseReshape_:IX})});function kX(r,t,e){let o=C(r,"data","sparseSegmentMean"),n=C(t,"indices","sparseSegmentMean","int32"),s=C(e,"segmentIds","sparseSegmentMean","int32");if(o.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
          ${n.shape}`);if(s.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
          ${s.shape}`);let a={data:o,indices:n,segmentIds:s};return E.runKernel(Ac,a)}var Gk,Wk=h(()=>{B();H();P();F();Gk=T({sparseSegmentMean_:kX})});function EX(r,t,e){let o=C(r,"data","sparseSegmentSum"),n=C(t,"indices","sparseSegmentSum","int32"),s=C(e,"segmentIds","sparseSegmentSum","int32");if(o.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
         ${n.shape}`);if(s.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
         ${s.shape}`);let a={data:o,indices:n,segmentIds:s};return E.runKernel(_c,a)}var Uk,Hk=h(()=>{B();H();P();F();Uk=T({sparseSegmentSum_:EX})});function $X(r,t,e,o,n,s,a,i){let c=C(r,"data","stringNGrams","string");if(c.dtype!=="string")throw new Error("Data must be of datatype string");if(c.shape.length!==1)throw new Error(`Data must be a vector, saw: ${c.shape}`);let l=C(t,"dataSplits","stringNGrams");if(l.dtype!=="int32")throw new Error("Data splits must be of datatype int32");let u={separator:e,nGramWidths:o,leftPad:n,rightPad:s,padWidth:a,preserveShortSequences:i},p={data:c,dataSplits:l},m=E.runKernel(Oc,p,u);return{nGrams:m[0],nGramsSplits:m[1]}}var Kk,qk=h(()=>{B();H();P();F();Kk=T({stringNGrams_:$X})});function RX(r,t,e=!0){let o=C(r,"input","stringSplit","string"),n=C(t,"delimiter","stringSplit","string");if(o.rank!==1)throw new Error(`Input should be Tensor1D but received shape ${o.shape}`);if(n.rank!==0)throw new Error(`Delimiter should be a scalar but received shape ${n.shape}`);let s={skipEmpty:e},a={input:o,delimiter:n},i=E.runKernel(Pc,a,s);return{indices:i[0],values:i[1],shape:i[2]}}var Xk,jk=h(()=>{B();H();P();F();Xk=T({stringSplit_:RX})});function AX(r,t){let e=C(r,"input","stringToHashBucketFast","string"),o={numBuckets:t};if(t<=0)throw new Error("Number of buckets must be at least 1");let n={input:e};return E.runKernel(Lc,n,o)}var Yk,Zk=h(()=>{B();H();P();F();Yk=T({stringToHashBucketFast_:AX})});function _X(r,t,e,o=!0){let n=C(r,"input","staticRegexReplace","string"),s={pattern:t,rewrite:e,replaceGlobal:o};return E.runKernel(na,{x:n},s)}var Qk,Jk=h(()=>{B();H();P();F();Qk=T({staticRegexReplace_:_X})});var DX,FX,Lf,OX,PX,LX,MX,Xu=h(()=>{wa();zC();WC();Ie();HC();qC();jC();ZC();JC();eS();oS();sS();iS();lS();Wx();fS();hS();Hx();yu();bS();wS();SS();Kx();TS();kS();qx();sn();rr();$S();AS();ol();On();yo();DS();OS();LS();BS();zS();bu();WS();HS();jS();ZS();JS();eN();oN();sN();iN();km();lN();pN();hr();dN();gN();Yx();Zx();yN();jx();vN();NN();ul();Fm();IN();ty();sl();ey();Bx();ry();Bm();oy();$u();EN();RN();_N();ny();sy();Gm();FN();PN();_u();ay();BN();zN();cy();Xm();ly();uy();WN();HN();Vn();Su();py();qN();jN();my();ef();ZN();Jx();of();JN();eT();oT();ae();sT();iT();mn();fy();lT();rf();pT();fT();ml();hT();xT();bT();wT();ST();Iu();hy();Mx();TT();kT();$T();AT();DT();ZT();Sy();JT();ff();e1();df();Mu();o1();Bu();Ny();Et();Aa();s1();i1();l1();p1();Ty();f1();nr();h1();x1();b1();gu();w1();S1();T1();oo();k1();$1();A1();D1();O1();iy();dy();yf();bf();Iy();wf();zu();ll();un();ky();Sf();Gu();Ey();L1();De();vo();B1();Ux();lu();Yn();Tf();$y();z1();W1();H1();j1();Om();Z1();J1();eI();oI();Ef();sI();iI();il();Ay();Ou();an();cI();_y();ku();lI();uI();Qm();fI();dI();xI();Ku();yI();F();wf();yf();bf();Iy();AI();DI();Oy();Py();OI();LI();BI();zI();WI();HI();qI();QI();tk();rk();nk();ak();ck();uk();mk();dk();gk();yk();wk();Sk();Wo();Tk();kk();$k();Ak();Dk();Ok();Lk();Bk();zk();Wk();Hk();qk();jk();Zk();Jk();DX={fft:dl,ifft:_a,rfft:hl,irfft:vf},FX={hammingWindow:_I,hannWindow:_f,frame:Df,stft:FI},Lf={flipLeftRight:MI,grayscaleToRGB:VI,resizeNearestNeighbor:lk,resizeBilinear:ik,rgbToGrayscale:GI,rotateWithOffset:UI,cropAndResize:PI,nonMaxSuppression:KI,nonMaxSuppressionAsync:ZI,nonMaxSuppressionWithScore:JI,nonMaxSuppressionWithScoreAsync:ek,nonMaxSuppressionPadded:ok,nonMaxSuppressionPaddedAsync:sk,threshold:pk,transform:fk},OX={bandPart:hk,gramSchmidt:xk,qr:vk},PX={absoluteDifference:Ck,computeWeightedLoss:je,cosineDistance:Nk,hingeLoss:Ik,huberLoss:Ek,logLoss:Rk,meanSquaredError:_k,sigmoidCrossEntropy:Fk,softmaxCrossEntropy:Pk},LX={sparseFillEmptyRows:Mk,sparseReshape:Vk,sparseSegmentMean:Gk,sparseSegmentSum:Uk},MX={stringNGrams:Kk,stringSplit:Xk,stringToHashBucketFast:Yk,staticRegexReplace:Qk}});function tE(r,t,e){$(r.className!=null,()=>"Class being registered does not have the static className property defined."),$(typeof r.className=="string",()=>"className is required to be a string, but got type "+typeof r.className),$(r.className.length>0,()=>"Class being registered has an empty-string as its className, which is disallowed."),typeof t=="undefined"&&(t="Custom"),typeof e=="undefined"&&(e=r.className);let o=e,n=t+">"+o;return My.register(r),BX.set(n,r),VX.set(r,n),r}var BX,VX,Mf,My,By=h(()=>{X();BX=new Map,VX=new Map,Mf=class{getClassName(){return this.constructor.className}static fromConfig(t,e){return new t(e)}},My=class r{constructor(){this.classNameMap={}}static getMap(){return r.instance==null&&(r.instance=new r),r.instance}static register(t){r.getMap().classNameMap[t.className]=[t,t.fromConfig]}}});var br,Ba=h(()=>{Ar();qn();Xu();By();br=class extends Mf{minimize(t,e=!1,o){let{value:n,grads:s}=this.computeGradients(t,o);if(o!=null){let a=o.map(i=>({name:i.name,tensor:s[i.name]}));this.applyGradients(a)}else this.applyGradients(s);return se(s),e?n:(n.dispose(),null)}get iterations(){return this.iterations_==null&&(this.iterations_=0),this.iterations_}incrementIterations(){this.iterations_=this.iterations+1}computeGradients(t,e){return LN(t,e)}dispose(){this.iterations_!=null&&se(this.iterations_)}async saveIterations(){return this.iterations_==null&&(this.iterations_=0),{name:"iter",tensor:bt(this.iterations_,"int32")}}async getWeights(){throw new Error("getWeights() is not implemented for this optimizer yet.")}async setWeights(t){throw new Error(`setWeights() is not implemented for this optimizer class ${this.getClassName()}`)}async extractIterations(t){return this.iterations_=(await t[0].tensor.data())[0],t.slice(1)}};Object.defineProperty(br,Symbol.hasInstance,{value:r=>r.minimize!=null&&r.computeGradients!=null&&r.applyGradients!=null})});var Bf,eE=h(()=>{B();Ar();Ie();hr();ae();Xu();un();an();Ba();Bf=class extends br{static get className(){return"Adadelta"}constructor(t,e,o=null){super(),this.learningRate=t,this.rho=e,this.epsilon=o,this.accumulatedGrads=[],this.accumulatedUpdates=[],o==null&&(this.epsilon=E.backend.epsilon())}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=E.registeredVariables[o],a=!1;this.accumulatedGrads[n]==null&&(this.accumulatedGrads[n]={originalName:`${o}/accum_grad`,variable:Tt(()=>ke(s).variable(a))}),this.accumulatedUpdates[n]==null&&(this.accumulatedUpdates[n]={originalName:`${o}/accum_var`,variable:Tt(()=>ke(s).variable(a))});let i=Array.isArray(t)?t[n].tensor:t[o];if(i==null)return;let c=this.accumulatedGrads[n].variable,l=this.accumulatedUpdates[n].variable;Tt(()=>{let u=mt(tt(c,this.rho),tt(Ve(i),1-this.rho)),p=tt(Dt(xr(mt(l,this.epsilon)),xr(mt(c,this.epsilon))),i),m=mt(tt(l,this.rho),tt(Ve(p),1-this.rho));c.assign(u),l.assign(m);let f=mt(tt(p,-this.learningRate),s);s.assign(f)})}),this.incrementIterations()}dispose(){this.accumulatedUpdates!=null&&(se(this.accumulatedGrads.map(t=>t.variable)),se(this.accumulatedUpdates.map(t=>t.variable)))}async getWeights(){let t=[...this.accumulatedGrads,...this.accumulatedUpdates];return[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=t.length/2,o=!1;this.accumulatedGrads=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedUpdates=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)}))}getConfig(){return{learningRate:this.learningRate,rho:this.rho,epsilon:this.epsilon}}static fromConfig(t,e){return new t(e.learningRate,e.rho,e.epsilon)}}});var Vf,rE=h(()=>{B();Ar();Ie();hr();sl();ae();ll();un();Ba();Vf=class extends br{static get className(){return"Adagrad"}constructor(t,e=.1){super(),this.learningRate=t,this.initialAccumulatorValue=e,this.accumulatedGrads=[]}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=E.registeredVariables[o];this.accumulatedGrads[n]==null&&(this.accumulatedGrads[n]={originalName:`${o}/accumulator`,variable:Tt(()=>Lo(s.shape,this.initialAccumulatorValue).variable(!1))});let a=Array.isArray(t)?t[n].tensor:t[o];if(a==null)return;let i=this.accumulatedGrads[n].variable;Tt(()=>{let c=mt(i,Ve(a));i.assign(c);let l=mt(tt(Dt(a,xr(mt(c,E.backend.epsilon()))),-this.learningRate),s);s.assign(l)})}),this.incrementIterations()}dispose(){this.accumulatedGrads!=null&&se(this.accumulatedGrads.map(t=>t.variable))}async getWeights(){return[await this.saveIterations()].concat(this.accumulatedGrads.map(t=>({name:t.originalName,tensor:t.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=!1;this.accumulatedGrads=t.map(o=>({originalName:o.name,variable:o.tensor.variable(e)}))}getConfig(){return{learningRate:this.learningRate,initialAccumulatorValue:this.initialAccumulatorValue}}static fromConfig(t,e){return new t(e.learningRate,e.initialAccumulatorValue)}}});var zf,oE=h(()=>{B();Ar();Ie();hr();ae();Iu();nr();ll();un();De();an();Ba();zf=class extends br{static get className(){return"Adam"}constructor(t,e,o,n=null){super(),this.learningRate=t,this.beta1=e,this.beta2=o,this.epsilon=n,this.accumulatedFirstMoment=[],this.accumulatedSecondMoment=[],Tt(()=>{this.accBeta1=bt(e).variable(),this.accBeta2=bt(o).variable()}),n==null&&(this.epsilon=E.backend.epsilon())}applyGradients(t){let e=Array.isArray(t)?t.map(o=>o.name):Object.keys(t);Tt(()=>{let o=vt(1,this.accBeta1),n=vt(1,this.accBeta2);e.forEach((s,a)=>{let i=E.registeredVariables[s],c=!1;this.accumulatedFirstMoment[a]==null&&(this.accumulatedFirstMoment[a]={originalName:`${s}/m`,variable:Tt(()=>ke(i).variable(c))}),this.accumulatedSecondMoment[a]==null&&(this.accumulatedSecondMoment[a]={originalName:`${s}/v`,variable:Tt(()=>ke(i).variable(c))});let l=Array.isArray(t)?t[a].tensor:t[s];if(l==null)return;let u=this.accumulatedFirstMoment[a].variable,p=this.accumulatedSecondMoment[a].variable,m=mt(tt(u,this.beta1),tt(l,1-this.beta1)),f=mt(tt(p,this.beta2),tt(Ve(l),1-this.beta2)),d=Dt(m,o),x=Dt(f,n);u.assign(m),p.assign(f);let g=mt(tt(Dt(d,mt(xr(x),this.epsilon)),-this.learningRate),i);i.assign(g)}),this.accBeta1.assign(tt(this.accBeta1,this.beta1)),this.accBeta2.assign(tt(this.accBeta2,this.beta2))}),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.accBeta2.dispose(),this.accumulatedFirstMoment!=null&&se(this.accumulatedFirstMoment.map(t=>t.variable)),this.accumulatedSecondMoment!=null&&se(this.accumulatedSecondMoment.map(t=>t.variable))}async getWeights(){let t=[...this.accumulatedFirstMoment,...this.accumulatedSecondMoment];return[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t),Tt(()=>{this.accBeta1.assign(ln(this.beta1,this.iterations_+1)),this.accBeta2.assign(ln(this.beta2,this.iterations_+1))});let e=t.length/2,o=!1;this.accumulatedFirstMoment=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedSecondMoment=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)}))}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon}}static fromConfig(t,e){return new t(e.learningRate,e.beta1,e.beta2,e.epsilon)}}});var Gf,nE=h(()=>{B();Ar();wa();Ie();hr();my();ae();nr();De();an();Ba();Gf=class extends br{static get className(){return"Adamax"}constructor(t,e,o,n=null,s=0){super(),this.learningRate=t,this.beta1=e,this.beta2=o,this.epsilon=n,this.decay=s,this.accumulatedFirstMoment=[],this.accumulatedWeightedInfNorm=[],Tt(()=>{this.iteration=bt(0).variable(),this.accBeta1=bt(e).variable()}),n==null&&(this.epsilon=E.backend.epsilon())}applyGradients(t){let e=Array.isArray(t)?t.map(o=>o.name):Object.keys(t);Tt(()=>{let o=vt(1,this.accBeta1),n=Dt(-this.learningRate,mt(tt(this.iteration,this.decay),1));e.forEach((s,a)=>{let i=E.registeredVariables[s],c=!1;this.accumulatedFirstMoment[a]==null&&(this.accumulatedFirstMoment[a]={originalName:`${s}/m`,variable:ke(i).variable(c)}),this.accumulatedWeightedInfNorm[a]==null&&(this.accumulatedWeightedInfNorm[a]={originalName:`${s}/v`,variable:ke(i).variable(c)});let l=Array.isArray(t)?t[a].tensor:t[s];if(l==null)return;let u=this.accumulatedFirstMoment[a].variable,p=this.accumulatedWeightedInfNorm[a].variable,m=mt(tt(u,this.beta1),tt(l,1-this.beta1)),f=tt(p,this.beta2),d=Be(l),x=tf(f,d);u.assign(m),p.assign(x);let g=mt(tt(Dt(n,o),Dt(m,mt(x,this.epsilon))),i);i.assign(g)}),this.iteration.assign(mt(this.iteration,1)),this.accBeta1.assign(tt(this.accBeta1,this.beta1))}),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.iteration.dispose(),this.accumulatedFirstMoment!=null&&se(this.accumulatedFirstMoment.map(t=>t.variable)),this.accumulatedWeightedInfNorm!=null&&se(this.accumulatedWeightedInfNorm.map(t=>t.variable))}async getWeights(){throw new Error("getWeights() is not implemented for Adamax yet.")}async setWeights(t){throw new Error("setWeights() is not implemented for Adamax yet.")}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon,decay:this.decay}}static fromConfig(t,e){return new t(e.learningRate,e.beta1,e.beta2,e.epsilon,e.decay)}}});var xl,Vy=h(()=>{B();Ar();Ie();ae();nr();Ba();xl=class extends br{static get className(){return"SGD"}constructor(t){super(),this.learningRate=t,this.setLearningRate(t)}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=Array.isArray(t)?t[n].tensor:t[o];if(s==null)return;let a=E.registeredVariables[o];Tt(()=>{let i=mt(tt(this.c,s),a);a.assign(i)})}),this.incrementIterations()}setLearningRate(t){this.learningRate=t,this.c!=null&&this.c.dispose(),this.c=fr(bt(-t))}dispose(){this.c.dispose()}async getWeights(){return[await this.saveIterations()]}async setWeights(t){if(t=await this.extractIterations(t),t.length!==0)throw new Error("SGD optimizer does not have settable weights.")}getConfig(){return{learningRate:this.learningRate}}static fromConfig(t,e){return new t(e.learningRate)}}});var Wf,sE=h(()=>{B();Ar();Ie();ae();nr();an();Vy();Wf=class extends xl{static get className(){return"Momentum"}constructor(t,e,o=!1){super(t),this.learningRate=t,this.momentum=e,this.useNesterov=o,this.accumulations=[],this.m=bt(this.momentum)}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=E.registeredVariables[o];this.accumulations[n]==null&&(this.accumulations[n]={originalName:`${o}/momentum`,variable:Tt(()=>ke(s).variable(!1))});let a=this.accumulations[n].variable,i=Array.isArray(t)?t[n].tensor:t[o];i!=null&&Tt(()=>{let c,l=mt(tt(this.m,a),i);this.useNesterov?c=mt(tt(this.c,mt(i,tt(l,this.m))),s):c=mt(tt(this.c,l),s),a.assign(l),s.assign(c)})}),this.incrementIterations()}dispose(){this.m.dispose(),this.accumulations!=null&&se(this.accumulations.map(t=>t.variable))}setMomentum(t){this.momentum=t}async getWeights(){return[await this.saveIterations()].concat(this.accumulations.map(t=>({name:t.originalName,tensor:t.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=!1;this.accumulations=t.map(o=>({originalName:o.name,variable:o.tensor.variable(e)}))}getConfig(){return{learningRate:this.learningRate,momentum:this.momentum,useNesterov:this.useNesterov}}static fromConfig(t,e){return new t(e.learningRate,e.momentum,e.useNesterov)}}});var Uf,aE=h(()=>{B();Ar();Ie();hr();ae();ll();un();De();an();Ba();Uf=class extends br{static get className(){return"RMSProp"}constructor(t,e=.9,o=0,n=null,s=!1){if(super(),this.learningRate=t,this.decay=e,this.momentum=o,this.epsilon=n,this.accumulatedMeanSquares=[],this.accumulatedMoments=[],this.accumulatedMeanGrads=[],this.centered=s,n==null&&(this.epsilon=E.backend.epsilon()),t==null)throw new Error("learningRate for RMSPropOptimizer must be defined.")}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=E.registeredVariables[o],a=!1;this.accumulatedMeanSquares[n]==null&&(this.accumulatedMeanSquares[n]={originalName:`${o}/rms`,variable:Tt(()=>ke(s).variable(a))}),this.accumulatedMoments[n]==null&&(this.accumulatedMoments[n]={originalName:`${o}/momentum`,variable:Tt(()=>ke(s).variable(a))}),this.accumulatedMeanGrads[n]==null&&this.centered&&(this.accumulatedMeanGrads[n]={originalName:`${o}/mg`,variable:Tt(()=>ke(s).variable(a))});let i=Array.isArray(t)?t[n].tensor:t[o];if(i==null)return;let c=this.accumulatedMeanSquares[n].variable,l=this.accumulatedMoments[n].variable;Tt(()=>{let u=mt(tt(c,this.decay),tt(Ve(i),1-this.decay));if(this.centered){let p=this.accumulatedMeanGrads[n].variable,m=mt(tt(p,this.decay),tt(i,1-this.decay)),f=Dt(tt(i,this.learningRate),xr(vt(u,mt(Ve(m),this.epsilon)))),d=mt(tt(l,this.momentum),f);c.assign(u),p.assign(m),l.assign(d);let x=vt(s,d);s.assign(x)}else{let p=mt(tt(c,this.decay),tt(Ve(i),1-this.decay)),m=mt(tt(l,this.momentum),Dt(tt(i,this.learningRate),xr(mt(p,this.epsilon))));c.assign(p),l.assign(m);let f=vt(s,m);s.assign(f)}})}),this.incrementIterations()}dispose(){this.accumulatedMeanSquares!=null&&se(this.accumulatedMeanSquares.map(t=>t.variable)),this.accumulatedMeanGrads!=null&&this.centered&&se(this.accumulatedMeanGrads.map(t=>t.variable)),this.accumulatedMoments!=null&&se(this.accumulatedMoments.map(t=>t.variable))}async getWeights(){let t=[...this.accumulatedMeanSquares,...this.accumulatedMoments];return this.centered&&t.push(...this.accumulatedMeanGrads),[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=this.centered?t.length/3:t.length/2,o=!1;this.accumulatedMeanSquares=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedMoments=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.centered&&(this.accumulatedMeanGrads=t.slice(e*2,e*3).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})))}getConfig(){return{learningRate:this.learningRate,decay:this.decay,momentum:this.momentum,epsilon:this.epsilon,centered:this.centered}}static fromConfig(t,e){return new t(e.learningRate,e.decay,e.momentum,e.epsilon,e.centered)}}});function iE(){for(let r of zX)tE(r)}var zX,cE=h(()=>{eE();rE();oE();nE();sE();aE();Vy();By();zX=[Bf,Vf,zf,Gf,Wf,Uf,xl]});function lE(r){return new Promise(t=>setTimeout(t)).then(r)}function KX(r="model"){return new yl(r)}function uE(r){return new zy(r)}var GX,WX,UX,yl,zy,HX,pE=h(()=>{Jc();Ke();Mn();ba();Pn();GX="model",WX=".json",UX=".weights.bin";yl=class r{constructor(t){if(!O().getBool("IS_BROWSER"))throw new Error("browserDownloads() cannot proceed because the current environment is not a browser.");t.startsWith(r.URL_SCHEME)&&(t=t.slice(r.URL_SCHEME.length)),(t==null||t.length===0)&&(t=GX),this.modelJsonFileName=t+WX,this.weightDataFileName=t+UX}async save(t){if(typeof document=="undefined")throw new Error("Browser downloads are not supported in this environment since `document` is not present");let e=qe.join(t.weightData),o=window.URL.createObjectURL(new Blob([e],{type:"application/octet-stream"}));if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserDownloads.save() does not support saving model topology in binary formats yet.");{let n=[{paths:["./"+this.weightDataFileName],weights:t.weightSpecs}],s=hm(t,n),a=window.URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"application/json"})),i=this.modelJsonAnchor==null?document.createElement("a"):this.modelJsonAnchor;if(i.download=this.modelJsonFileName,i.href=a,await lE(()=>i.dispatchEvent(new MouseEvent("click"))),t.weightData!=null){let c=this.weightDataAnchor==null?document.createElement("a"):this.weightDataAnchor;c.download=this.weightDataFileName,c.href=o,await lE(()=>c.dispatchEvent(new MouseEvent("click")))}return{modelArtifactsInfo:_o(t)}}}};yl.URL_SCHEME="downloads://";zy=class{constructor(t){if(t==null||t.length<1)throw new Error(`When calling browserFiles, at least 1 file is required, but received ${t}`);this.jsonFile=t[0],this.weightsFiles=t.slice(1)}async load(){return new Promise((t,e)=>{let o=new FileReader;o.onload=n=>{let s=JSON.parse(n.target.result),a=s.modelTopology;if(a==null){e(new Error(`modelTopology field is missing from file ${this.jsonFile.name}`));return}if(s.weightsManifest==null){e(new Error(`weightManifest field is missing from file ${this.jsonFile.name}`));return}if(this.weightsFiles.length===0){t({modelTopology:a});return}let c=tl(s,l=>this.loadWeights(l));t(c)},o.onerror=n=>e(`Failed to read model topology and weights manifest JSON from file '${this.jsonFile.name}'. BrowserFiles supports loading Keras-style tf.Model artifacts only.`),o.readAsText(this.jsonFile)})}loadWeights(t){let e=[],o=[];for(let a of t)e.push(...a.weights),o.push(...a.paths);let n=this.checkManifestAndWeightFiles(t),s=o.map(a=>this.loadWeightsFile(a,n[a]));return Promise.all(s).then(a=>[e,a])}loadWeightsFile(t,e){return new Promise((o,n)=>{let s=new FileReader;s.onload=a=>{let i=a.target.result;o(i)},s.onerror=a=>n(`Failed to weights data from file of path '${t}'.`),s.readAsArrayBuffer(e)})}checkManifestAndWeightFiles(t){let e=[],o=this.weightsFiles.map(s=>kx(s.name)),n={};for(let s of t)s.paths.forEach(a=>{let i=kx(a);if(e.indexOf(i)!==-1)throw new Error(`Duplicate file basename found in weights manifest: '${i}'`);if(e.push(i),o.indexOf(i)===-1)throw new Error(`Weight file with basename '${i}' is not provided.`);n[a]=this.weightsFiles[o.indexOf(i)]});if(e.length!==this.weightsFiles.length)throw new Error(`Mismatch in the number of files in weights manifest (${e.length}) and the number of weight files provided (${this.weightsFiles.length}).`);return n}},HX=r=>O().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(yl.URL_SCHEME)?KX(r.slice(yl.URL_SCHEME.length)):null;Ae.registerSaveRouter(HX)});function Gy(r,t,e,o){a(r),e=e==null?0:e,o=o==null?1:o,i(e,o);let n=0,s=c=>(c.then(l=>{let u=e+ ++n/r.length*(o-e);return t(u),l}),c);function a(c){$(c!=null&&Array.isArray(c)&&c.length>0,()=>"promises must be a none empty array")}function i(c,l){$(c>=0&&c<=1,()=>`Progress fraction must be in range [0, 1], but got startFraction ${c}`),$(l>=0&&l<=1,()=>`Progress fraction must be in range [0, 1], but got endFraction ${l}`),$(l>=c,()=>`startFraction must be no more than endFraction, but got startFraction ${c} and endFraction ${l}`)}return Promise.all(r.map(s))}var mE=h(()=>{X();});async function Wy(r,t){t==null&&(t={});let e=t.fetchFunc==null?O().platform.fetch:t.fetchFunc,o=r.map(p=>e(p,t.requestInit,{isBinary:!0})),i=(t.onProgress==null?await Promise.all(o):await Gy(o,t.onProgress,0,.5)).map(p=>p.arrayBuffer());return t.onProgress==null?await Promise.all(i):await Gy(i,t.onProgress,.5,1)}function fE(r,t){var e;let o=t.fetchFunc==null?O().platform.fetch:t.fetchFunc,n=0,s;return(e=t.onProgress)===null||e===void 0||e.call(t,0),new ReadableStream({pull:async a=>{for(var i;n<r.length;){s||(s=(await o(r[n],t.requestInit,{isBinary:!0})).body.getReader());let{done:c,value:l}=await s.read();if(c){n++,s=void 0,(i=t.onProgress)===null||i===void 0||i.call(t,n/r.length);continue}a.enqueue(l);return}a.close()}})}async function dE(r,t="",e,o){return Uy(a=>Wy(a,{requestInit:o}))(r,t,e)}function Uy(r){return async(t,e="",o)=>{let n=t.map(()=>!1),s={},a=o!=null?o.map(()=>!1):[],i=[];if(t.forEach((f,d)=>{let x=0;f.weights.forEach(g=>{let y="quantization"in g?g.quantization.dtype:g.dtype,v=on[y]*$t(g.shape),N=()=>{n[d]=!0,s[d]==null&&(s[d]=[]),s[d].push({manifestEntry:g,groupOffset:x,sizeBytes:v})};o!=null?o.forEach((S,R)=>{S===g.name&&(N(),a[R]=!0)}):N(),i.push(g.name),x+=v})}),!a.every(f=>f)){let f=o.filter((d,x)=>!a[x]);throw new Error(`Could not find weights in manifest with names: ${f.join(", ")}. 
Manifest JSON has weights with names: ${i.join(", ")}.`)}let c=n.reduce((f,d,x)=>(d&&f.push(x),f),[]),l=[];c.forEach(f=>{t[f].paths.forEach(d=>{let x=e+(e.endsWith("/")?"":"/")+d;l.push(x)})});let u=await r(l),p={},m=0;return c.forEach(f=>{let d=t[f].paths.length,x=new qe(u.slice(m,m+d));s[f].forEach(y=>{let v=x.slice(y.groupOffset,y.groupOffset+y.sizeBytes),N=fm(v,[y.manifestEntry]);for(let S in N)p[S]=N[S]}),m+=d}),p}}var Hy=h(()=>{Ke();X();Pn();Mn();mE();Sx();});function jX(r){let t=r.lastIndexOf("/"),e=r.lastIndexOf("?"),o=r.substring(0,t),n=e>t?r.substring(e):"";return[o+"/",n]}function Hf(r){return r.match(ju.URL_SCHEME_REGEX)!=null}function Kf(r,t){return new ju(r,t)}function gE(r,t){return Kf(r,t)}var qX,XX,ju,hE,xE=h(()=>{Ke();X();Mn();Pn();ba();Hy();qX="application/octet-stream",XX="application/json",ju=class{constructor(t,e){if(this.DEFAULT_METHOD="POST",e==null&&(e={}),this.weightPathPrefix=e.weightPathPrefix,this.weightUrlConverter=e.weightUrlConverter,e.fetchFunc!=null?($(typeof e.fetchFunc=="function",()=>"Must pass a function that matches the signature of `fetch` (see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)"),this.fetch=e.fetchFunc):this.fetch=O().platform.fetch,$(t!=null&&t.length>0,()=>"URL path for http must not be null, undefined or empty."),Array.isArray(t)&&$(t.length===2,()=>`URL paths for http must have a length of 2, (actual length is ${t.length}).`),this.path=t,e.requestInit!=null&&e.requestInit.body!=null)throw new Error("requestInit is expected to have no pre-existing body, but has one.");this.requestInit=e.requestInit||{},this.loadOptions=e}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserHTTPRequest.save() does not support saving model topology in binary formats yet.");let e=Object.assign({method:this.DEFAULT_METHOD},this.requestInit);e.body=new FormData;let o=[{paths:["./model.weights.bin"],weights:t.weightSpecs}],n=hm(t,o);if(e.body.append("model.json",new Blob([JSON.stringify(n)],{type:XX}),"model.json"),t.weightData!=null){let a=qe.join(t.weightData);e.body.append("model.weights.bin",new Blob([a],{type:qX}),"model.weights.bin")}let s=await this.fetch(this.path,e);if(s.ok)return{modelArtifactsInfo:_o(t),responses:[s]};throw new Error(`BrowserHTTPRequest.save() failed due to HTTP response status ${s.status}.`)}async loadModelJSON(){let t=await this.fetch(this.path,this.requestInit);if(!t.ok)throw new Error(`Request to ${this.path} failed with status code ${t.status}. Please verify this URL points to the model JSON of the model to load.`);let e;try{e=await t.json()}catch{let a=`Failed to parse model JSON of response from ${this.path}.`;throw this.path.endsWith(".pb")?a+=" Your path contains a .pb file extension. Support for .pb models have been removed in TensorFlow.js 1.0 in favor of .json models. You can re-convert your Python TensorFlow model using the TensorFlow.js 1.0 conversion scripts or you can convert your.pb models with the 'pb2json'NPM script in the tensorflow/tfjs-converter repository.":a+=" Please make sure the server is serving valid JSON for this request.",new Error(a)}let o=e.modelTopology,n=e.weightsManifest;if(o==null&&n==null)throw new Error(`The JSON from HTTP path ${this.path} contains neither model topology or manifest for weights.`);return e}async load(){if(this.loadOptions.streamWeights)return this.loadStream();let t=await this.loadModelJSON();return tl(t,e=>this.loadWeights(e))}async loadStream(){let t=await this.loadModelJSON(),e=await this.getWeightUrls(t.weightsManifest),o=mu(t.weightsManifest),n=()=>fE(e,this.loadOptions);return Object.assign(Object.assign({},t),{weightSpecs:o,getWeightStream:n})}async getWeightUrls(t){let e=Array.isArray(this.path)?this.path[1]:this.path,[o,n]=jX(e),s=this.weightPathPrefix||o,a=[],i=[];for(let c of t)for(let l of c.paths)this.weightUrlConverter!=null?i.push(this.weightUrlConverter(l)):a.push(s+l+n);return this.weightUrlConverter&&a.push(...await Promise.all(i)),a}async loadWeights(t){let e=await this.getWeightUrls(t),o=mu(t),n=await Wy(e,this.loadOptions);return[o,n]}};ju.URL_SCHEME_REGEX=/^https?:\/\//;hE=(r,t)=>{if(typeof fetch=="undefined"&&(t==null||t.fetchFunc==null))return null;{let e=!0;if(Array.isArray(r)?e=r.every(o=>Hf(o)):e=Hf(r),e)return Kf(r,t)}return null};Ae.registerSaveRouter(hE);Ae.registerLoadRouter(hE)});function yE(r,t,e,o){let n=arguments;return new Ky(qy(...n))}function qy(r,t,e,o){return arguments.length===1?r.modelTopology!=null||r.weightSpecs!=null?new Yu(r):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Yu({modelTopology:r})):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Yu({modelTopology:r,weightSpecs:t,weightData:e,trainingConfig:o}))}function bE(r){return new qf(r)}function vE(r){return new qf(r)}var Yu,qf,Ky,wE=h(()=>{Yu=class{constructor(t){this.modelArtifacts=t}load(){return this.modelArtifacts}},qf=class{constructor(t){this.saveHandler=t}save(t){return this.saveHandler(t)}},Ky=class{constructor(t){t.load&&(this.load=()=>Promise.resolve(t.load())),t.save&&(this.save=e=>Promise.resolve(t.save(e)))}}});var Zu={};Yt(Zu,{CompositeArrayBuffer:()=>qe,browserFiles:()=>uE,browserHTTPRequest:()=>gE,concatenateArrayBuffers:()=>bC,copyModel:()=>DC,decodeWeights:()=>fm,decodeWeightsStream:()=>dm,encodeWeights:()=>hC,fromMemory:()=>yE,fromMemorySync:()=>qy,getLoadHandlers:()=>SC,getModelArtifactsForJSON:()=>tl,getModelArtifactsForJSONSync:()=>Ex,getModelArtifactsInfoForJSON:()=>_o,getSaveHandlers:()=>CC,getWeightSpecs:()=>mu,http:()=>Kf,isHTTPScheme:()=>Hf,listModels:()=>AC,loadWeights:()=>dE,moveModel:()=>FC,registerLoadRouter:()=>wC,registerSaveRouter:()=>vC,removeModel:()=>_C,weightsLoaderFactory:()=>Uy,withSaveHandler:()=>bE,withSaveHandlerSync:()=>vE});var CE=h(()=>{_x();Dx();pE();xE();Mn();wE();ba();Hy();Pn();Fx();});var Qu={};Yt(Qu,{draw:()=>oj,fromPixels:()=>nj,fromPixelsAsync:()=>tj,toPixels:()=>rj});function NE(r,t=3){if(t>4)throw new Error("Cannot construct Tensor with more than 4 channels from pixels.");if(r==null)throw new Error("pixels passed to tf.browser.fromPixels() can not be null");let e=!1,o=!1,n=!1,s=!1,a=!1,i=!1;if(r.data instanceof Uint8Array)e=!0;else if(typeof ImageData!="undefined"&&r instanceof ImageData)o=!0;else if(typeof HTMLVideoElement!="undefined"&&r instanceof HTMLVideoElement)n=!0;else if(typeof HTMLImageElement!="undefined"&&r instanceof HTMLImageElement)s=!0;else if(r.getContext!=null)a=!0;else if(typeof ImageBitmap!="undefined"&&r instanceof ImageBitmap)i=!0;else throw new Error(`pixels passed to tf.browser.fromPixels() must be either an HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, ImageData in browser, or OffscreenCanvas, ImageData in webworker or {data: Uint32Array, width: number, height: number}, but was ${r.constructor.name}`);if(Hc(ou,E.backendName)!=null){let d={pixels:r},x={numChannels:t};return E.runKernel(ou,d,x)}let[l,u]=n?[r.videoWidth,r.videoHeight]:[r.width,r.height],p;if(a)p=r.getContext("2d").getImageData(0,0,l,u).data;else if(o||e)p=r.data;else if(s||n||i){if(Va==null)if(typeof document=="undefined")if(typeof OffscreenCanvas!="undefined"&&typeof OffscreenCanvasRenderingContext2D!="undefined")Va=new OffscreenCanvas(1,1).getContext("2d");else throw new Error("Cannot parse input in current context. Reason: OffscreenCanvas Context2D rendering is not supported.");else Va=document.createElement("canvas").getContext("2d",{willReadFrequently:!0});Va.canvas.width=l,Va.canvas.height=u,Va.drawImage(r,0,0,l,u),p=Va.getImageData(0,0,l,u).data}let m;if(t===4)m=new Int32Array(p);else{let d=l*u;m=new Int32Array(d*t);for(let x=0;x<d;x++)for(let g=0;g<t;++g)m[x*t+g]=p[x*4+g]}return If(m,[u,l,t],"int32")}function YX(r){return r!=null&&r.data instanceof Uint8Array}function ZX(){return typeof window!="undefined"&&typeof ImageBitmap!="undefined"&&window.hasOwnProperty("createImageBitmap")}function QX(r){return r!=null&&r.width!==0&&r.height!==0}function JX(r){return ZX()&&!(r instanceof ImageBitmap)&&QX(r)&&!YX(r)}async function tj(r,t=3){let e=null;if(O().getBool("WRAP_TO_IMAGEBITMAP")&&JX(r)){let o;try{o=await createImageBitmap(r,{premultiplyAlpha:"none"})}catch{o=null}o!=null&&o.width===r.width&&o.height===r.height?e=o:e=r}else e=r;return NE(e,t)}function TE(r){if(r.rank!==2&&r.rank!==3)throw new Error(`toPixels only supports rank 2 or 3 tensors, got rank ${r.rank}.`);let t=r.rank===2?1:r.shape[2];if(t>4||t===2)throw new Error(`toPixels only supports depth of size 1, 3 or 4 but got ${t}`);if(r.dtype!=="float32"&&r.dtype!=="int32")throw new Error(`Unsupported type for toPixels: ${r.dtype}. Please use float32 or int32 tensors.`)}function ej(r){let t=(r==null?void 0:r.alpha)||1;if(t>1||t<0)throw new Error(`Alpha value ${t} is suppoed to be in range [0 - 1].`)}async function rj(r,t){let e=C(r,"img","toPixels");if(!(r instanceof ee)){let l=e;e=_t(l,"int32"),l.dispose()}TE(e);let[o,n]=e.shape.slice(0,2),s=e.rank===2?1:e.shape[2],a=await e.data(),i=e.dtype==="float32"?255:1,c=new Uint8ClampedArray(n*o*4);for(let l=0;l<o*n;++l){let u=[0,0,0,255];for(let m=0;m<s;m++){let f=a[l*s+m];if(e.dtype==="float32"){if(f<0||f>1)throw new Error(`Tensor values for a float32 Tensor must be in the range [0 - 1] but encountered ${f}.`)}else if(e.dtype==="int32"&&(f<0||f>255))throw new Error(`Tensor values for a int32 Tensor must be in the range [0 - 255] but encountered ${f}.`);s===1?(u[0]=f*i,u[1]=f*i,u[2]=f*i):u[m]=f*i}let p=l*4;c[p+0]=Math.round(u[0]),c[p+1]=Math.round(u[1]),c[p+2]=Math.round(u[2]),c[p+3]=Math.round(u[3])}if(t!=null){SE||Hc(ru,E.backendName)!=null&&(console.warn("tf.browser.toPixels is not efficient to draw tensor on canvas. Please try tf.browser.draw instead."),SE=!0),t.width=n,t.height=o;let l=t.getContext("2d"),u=new ImageData(c,n,o);l.putImageData(u,0,0)}return e!==r&&e.dispose(),c}function oj(r,t,e){let o=C(r,"img","draw");if(!(r instanceof ee)){let a=o;o=_t(a,"int32"),a.dispose()}TE(o),ej(e==null?void 0:e.imageOptions);let n={image:o},s={canvas:t,options:e};E.runKernel(ru,n,s)}var Va,SE,nj,IE=h(()=>{B();Ke();H();rm();Kr();P();rr();F();$y();SE=!1;nj=T({fromPixels_:NE})});function sj(r,t){let e=r.shape.length,o=t.shape.length;if(e<1)throw new Error(`tf.gatherND() expects the input to be rank 1 or higher, but the rank was ${e}.`);if(o<1)throw new Error(`tf.gatherND() expects the indices to be rank 1 or higher, but the rank was ${o}.`);if(t.dtype!=="int32")throw new Error(`tf.gatherND() expects the indices to be int32 type, but the dtype was ${t.dtype}.`);if(t.shape[o-1]>e)throw new Error(`index innermost dimension length must be <= tensor rank; saw: ${t.shape[o-1]} vs. ${e}`);if($t(r.shape)===0)throw new Error(`Requested more than 0 entries, but input is empty. Input shape: ${r.shape}.`);let n=t.shape,s=n[n.length-1],a=1;for(let p=0;p<n.length-1;++p)a*=n[p];let i=r.shape,c=n.slice();c.pop();let l=1;for(let p=s;p<e;++p)l*=i[p],c.push(i[p]);let u=[...Ao(r.shape).map(p=>p/l),1].slice(0,s);return[c,a,l,u]}var kE=h(()=>{X()});var Fe={};Yt(Fe,{assertParamsValid:()=>ij,computeFlatOffset:()=>mj,computeOutShape:()=>lj,getNormalizedAxes:()=>uj,isSliceContinous:()=>pj,maskToAxes:()=>cj,parseSliceParams:()=>fj,sliceInfo:()=>dj,startForAxis:()=>OE,startIndicesWithElidedDims:()=>_E,stopForAxis:()=>PE,stopIndicesWithElidedDims:()=>DE,stridesForAxis:()=>FE,stridesWithElidedDims:()=>$E});function ij(r,t,e){let o=r.shape.length;$(o===t.length,()=>`Error in slice${o}D: Length of begin ${t} must match the rank of the array (${o}).`),$(o===e.length,()=>`Error in slice${o}D: Length of size ${e} must match the rank of the array (${o}).`);for(let n=0;n<o;++n)$(t[n]+e[n]<=r.shape[n],()=>`Error in slice${o}D: begin[${n}] + size[${n}] (${t[n]+e[n]}) would overflow input.shape[${n}] (${r.shape[n]})`)}function cj(r){let t=[],e=0;for(;r>0;)r&1&&t.push(e),r/=2,e++;return t}function lj(r,t,e){let o=[];for(let n=0;n<r.length;n++)o[n]=Math.ceil((t[n]-r[n])/e[n]);return o}function $E(r,t,e,o){let n=[...r];for(let s=n.length;s<o.length;s++)n.push(1);for(let s=0;s<e;s++)s===0?n[t]=1:(n.splice(t,0,1),n.pop());return n}function RE(r,t,e){return e<=r?e:e-(t-1)}function AE(r,t){let e=[];for(let o=0;o<r;o++)e.push(t+o);return e}function uj(r,t,e,o,n,s,a,i,c){let l=r.length,u=new Array(l),p=new Array(l),m=new Array(l);if(t.length&&e>0){let f=t[0],d=e+1;u=_E(a,f,d,o,r),p=DE(i,f,d,n,r),m=$E(s,f,d,r)}else for(let f=0;f<l;f++)u[f]=OE(a,o,s,r,f,c),p[f]=PE(i,n,s,r,f,c),m[f]=FE(s,f,c);return{begin:u,end:p,strides:m}}function _E(r,t,e,o,n){let s=[...n],a=AE(e,t);for(let i=0;i<s.length;i++)if(a.indexOf(i)>-1)s[i]=0;else{let c=RE(t,e,i),l=o[c];r&1<<c&&(l=0),s[i]=l}return s}function DE(r,t,e,o,n){let s=[...n],a=AE(e,t);for(let i=0;i<s.length;i++)if(a.indexOf(i)>-1)s[i]=Number.MAX_SAFE_INTEGER;else{let c=RE(t,e,i),l=o[c];r&1<<c&&(l=Number.MAX_SAFE_INTEGER),s[i]=l}for(let i=0;i<s.length;i++){let c=n[i];s[i]<0&&(s[i]+=c),s[i]=ii(0,s[i],n[i])}return s}function FE(r,t,e){let o=r[t];return(e&1<<t||o==null)&&(o=1),o}function OE(r,t,e,o,n,s){let a=t[n],i=e[n]||1;(r&1<<n||s&1<<n||a==null)&&(i>0?a=Number.MIN_SAFE_INTEGER:a=Number.MAX_SAFE_INTEGER);let c=o[n];return a<0&&(a+=c),a=ii(0,a,c-1),a}function PE(r,t,e,o,n,s){let a=t[n],i=e[n]||1;(r&1<<n||s&1<<n||a==null)&&(i>0?a=Number.MAX_SAFE_INTEGER:a=Number.MIN_SAFE_INTEGER);let c=o[n];return a<0&&(a+=c),i>0?a=ii(0,a,c):a=ii(-1,a,c-1),a}function pj(r,t,e){let o=e.length;for(let n=0;n<e.length;n++)if(e[n]>1){o=n;break}for(let n=o+1;n<e.length;n++)if(t[n]>0||e[n]!==r[n])return!1;return!0}function mj(r,t){let e=r.length>0?r[r.length-1]:1;for(let o=0;o<r.length-1;o++)e+=r[o]*t[o];return e}function fj(r,t,e){let o,n=r.shape.length;typeof t=="number"?o=[t,...new Array(n-1).fill(0)]:t.length<n?o=t.concat(new Array(n-t.length).fill(0)):o=t.slice(),o.forEach(a=>{$(a!==-1,()=>"slice() does not support negative begin indexing.")});let s;return e==null?s=new Array(n).fill(-1):typeof e=="number"?s=[e,...new Array(n-1).fill(-1)]:e.length<n?s=e.concat(new Array(n-e.length).fill(-1)):s=e,s=s.map((a,i)=>a>=0?a:($(a===-1,()=>`Negative size values should be exactly -1 but got ${a} for the slice() size at index ${i}.`),r.shape[i]-o[i])),[o,s]}function dj(r,t,e,o,n,s,a,i,c){let l;if(o==null?(l=new Array(t.length),l.fill(1)):l=o,a!=null&&(a&a-1)!==0)throw new Error("Multiple ellipses in slice is not allowed.");let u=!1,p={dims:l.length,numAddAxisAfterEllipsis:0,begin:t.slice(),end:e.slice(),strides:l.slice(),beginMask:n,endMask:s,ellipsisMask:a,newAxisMask:i,shrinkAxisMask:c};for(let N=0;N<p.dims;N++)u&&(1<<N&i)!==0&&p.numAddAxisAfterEllipsis++,1<<N&a&&(u=!0);u||(p.ellipsisMask|=1<<p.dims,p.dims++);let m={dims:r.length,beginMask:0,endMask:0,beginValid:!1,endValid:!1};hj(p,m);let f=!0,d=!0,x=!0,g=[],y=[];for(let N=0;N<r.length;++N){if(m.strides[N]===0)throw Error(`strides[${N}] must be non-zero`);let S=!!(m.shrinkAxisMask&1<<N),R=r[N];if(R===-1){g.push(S?1:-1);continue}let A=[m.beginMask&1<<N,m.endMask&1<<N],_=[m.strides[N]>0?0:-1,m.strides[N]>0?R:R-1];if(S&&m.strides[N]<=0)throw Error("only stride 1 allowed on non-range indexing.");x=x&&m.strides[N]===1;let D=!!(m.beginMask&1<<N&&m.endMask&1<<N);if(m.beginValid&&m.endValid){if(S){let W=m.begin[N]<0?R+m.begin[N]:m.begin[N];if(m.begin[N]=W,m.end[N]=m.begin[N]+1,W<0||W>=R)throw Error(`slice index ${m.begin[N]} of dimension ${N} out of bounds.`)}else m.begin[N]=EE(m.begin[N],0,m.strides[N],R,A,_),m.end[N]=EE(m.end[N],1,m.strides[N],R,A,_);let V=m.strides[N]===1&&m.begin[N]===0&&m.end[N]===R;f=f&&V,d=d&&(N===0&&m.strides[N]===1||V)}else f=f&&m.strides[N]===1&&D,d=d&&(N===0&&m.strides[N]===1||D);let L,M=!1;if(m.beginValid&&m.endValid?(L=m.end[N]-m.begin[N],M=!0):S?(L=1,M=!0):D&&R>=0&&(m.strides[N]<0?L=-R:L=R,M=!0),M){let V;L===0||L<0!=m.strides[N]<0?V=0:V=Math.trunc(L/m.strides[N])+(L%m.strides[N]!==0?1:0),g.push(V)}else g.push(-1)}for(let N=0;N<m.finalShapeGatherIndices.length;++N){let S=m.finalShapeGatherIndices[N];S>=0?y.push(g[S]):S===Xy&&y.push(1)}return{finalShapeSparse:y.filter((N,S)=>m.finalShapeGatherIndices[S]!==Xy),finalShape:y,isIdentity:f,sliceDim0:d,isSimpleSlice:x,begin:m.begin,end:m.end,strides:m.strides}}function hj(r,t){t.beginMask=0,t.endMask=0,t.shrinkAxisMask=0;let e=0;t.beginValid=r.begin!=null,t.endValid=r.end!=null,t.begin=new Array(t.dims),t.end=new Array(t.dims),t.strides=new Array(t.dims),t.finalShapeGatherIndices=[],t.finalShapeGatherIndicesSparse=[],t.inputShapeGatherIndicesSparse=new Array(t.dims);for(let o=0;o<r.dims;o++)if(1<<o&r.ellipsisMask){let n=Math.min(t.dims-(r.dims-o)+1+r.numAddAxisAfterEllipsis,t.dims);for(;e<n;e++)t.begin[e]=0,t.end[e]=0,t.strides[e]=1,t.beginMask|=1<<e,t.endMask|=1<<e,t.finalShapeGatherIndices.push(e),t.finalShapeGatherIndicesSparse.push(-1),t.inputShapeGatherIndicesSparse[e]=o}else if(1<<o&r.newAxisMask)t.finalShapeGatherIndices.push(Xy),t.finalShapeGatherIndicesSparse.push(-1);else{if(e===t.begin.length)throw Error(`Index out of range using input dim ${e}; input has only ${t.dims} dims, ${t.begin.length}.`);r.begin!=null&&(t.begin[e]=r.begin[o]),r.end!=null&&(t.end[e]=r.end[o]),t.strides[e]=r.strides[o],r.beginMask&1<<o&&(t.beginMask|=1<<e),r.endMask&1<<o&&(t.endMask|=1<<e),r.shrinkAxisMask&1<<o?(t.finalShapeGatherIndices.push(aj),t.finalShapeGatherIndicesSparse.push(-1),t.shrinkAxisMask|=1<<e):(t.finalShapeGatherIndices.push(e),t.finalShapeGatherIndicesSparse.push(o)),t.inputShapeGatherIndicesSparse[e]=o,e++}}function EE(r,t,e,o,n,s){if(n[t])return e>0?s[t]:s[t+1&1];{let a=r<0?o+r:r;return a<s[0]?s[0]:a>s[1]?s[1]:a}}var Xy,aj,jy=h(()=>{X();Xy=-2,aj=-1});var LE=h(()=>{});function Yy(){return new Promise(r=>gj(()=>r()))}var gj,ME=h(()=>{gj=typeof requestAnimationFrame!="undefined"?requestAnimationFrame:typeof setImmediate!="undefined"?setImmediate:r=>r()});function xj(r,t){let e=r[0].length;r.forEach((n,s)=>{$(n.length===e,()=>`Error in concat${e}D: rank of tensors[${s}] must be the same as the rank of the rest (${e})`)}),$(t>=0&&t<e,()=>`Error in concat${e}D: axis must be between 0 and ${e-1}.`);let o=r[0];r.forEach((n,s)=>{for(let a=0;a<e;a++)$(a===t||n[a]===o[a],()=>`Error in concat${e}D: Shape of tensors[${s}] (${n}) does not match the shape of the rest (${o}) along the non-concatenated axis ${s}.`)})}function yj(r,t){let e=r[0].slice();for(let o=1;o<r.length;o++)e[t]+=r[o][t];return e}var BE=h(()=>{X();});var VE=h(()=>{});function bj(r,t,e){let o=new Array;if(e==null&&t==null)return o;if(t==null)for(;o.length<r+e.length;)o.push(-1);else o=t.slice();if(e==null)return o;if(r+e.length!==o.length)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.rank = ${r+e.length}, but shape.rank = ${o.length}`);for(let n=1;n<e.length;++n){let s=e[n],a=o[o.length-e.length+n],i=o[a];if(s>=0)if(i>=0){if(i!==s)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.shape[${n+r}] = ${s} but shape[${n+r}] = ${i}`)}else o[a]=s}return o}function vj(r){let t={FIRST_DIM_SIZE:Uo.FIRST_DIM_SIZE,VALUE_ROWIDS:Uo.VALUE_ROWIDS,ROW_LENGTHS:Uo.ROW_LENGTHS,ROW_SPLITS:Uo.ROW_SPLITS,ROW_LIMITS:Uo.ROW_LIMITS,ROW_STARTS:Uo.ROW_STARTS},e=[];for(let o of r)if(o in t)e.push(t[o]);else break;return e}function wj(r){return r.length===0?0:r[0]===Uo.FIRST_DIM_SIZE?r.length-1:r.length}function Cj(r,t){if(r==null||t==null)return;let e=r.length,o=t.length;if(e>=o)throw new Error(`defaultValue.shape=${r} and ragged tensor flatValues.shape=${t}, are incompatible: defaultValue.rank = ${e} must be less than ragged tensor input flatValues.rank = ${o})`);for(let n=0;n<Math.min(e,o-1);++n){let s=r[n],a=t[n+1];if(s>=0&&a>=0&&s!==1&&s!==a)throw new Error(`defaultValue.shape=${r}, and ragged tensor input flatValues.shape=${t} are incompatible: defaultValue.shape[${n-r.length}] = ${s} but ragged tensor input.flatValues.shape[${n-r.length}] = ${a}`)}}var Uo,zE=h(()=>{(function(r){r[r.FIRST_DIM_SIZE=0]="FIRST_DIM_SIZE",r[r.VALUE_ROWIDS=1]="VALUE_ROWIDS",r[r.ROW_LENGTHS=2]="ROW_LENGTHS",r[r.ROW_SPLITS=3]="ROW_SPLITS",r[r.ROW_LIMITS=4]="ROW_LIMITS",r[r.ROW_STARTS=5]="ROW_STARTS"})(Uo||(Uo={}))});function Sj(r){return r<=Xf?r:pi(r,Math.floor(Math.sqrt(r)))}var Xf,Zy=h(()=>{X();Xf=30});function Nj(r,t,e){let o=e*(typeof r=="number"?r:r[0]),n=t*(typeof r=="number"?r:r[1]);return[o,n]}var GE=h(()=>{});function Tj(r,t,e,o=!0){let n=[];if(o)n=n.concat(t.slice(0)),n.push(r[0]/e),n=n.concat(r.slice(1));else{n=n.concat(r[0]);let s=t.length;for(let a=0;a<s;++a)n=n.concat([r[a+1]/t[a],t[a]]);n=n.concat(r.slice(s+1))}return n}function Ij(r,t,e=!0){let o=[];if(e){o.push(t);for(let n=t+1;n<r;++n)n<=2*t?(o.push(n),o.push(n-(t+1))):o.push(n)}else{let n=[],s=[];for(let a=1;a<r;++a)a>=t*2+1||a%2===1?s.push(a):n.push(a);o.push(...n),o.push(0),o.push(...s)}return o}function kj(r,t,e,o=!0){let n=[];o?n.push(r[0]/e):n.push(r[0]*e);for(let s=1;s<r.length;++s)s<=t.length?o?n.push(t[s-1]*r[s]):n.push(r[s]/t[s-1]):n.push(r[s]);return n}function Ej(r,t){let e=[0];for(let o=0;o<t;++o)e.push(r[o][0]);return e}function $j(r,t,e){let o=r.slice(0,1);for(let n=0;n<e;++n)o.push(r[n+1]-t[n][0]-t[n][1]);return o}var WE=h(()=>{});var Rj,Aj,UE=h(()=>{Rj=1.7580993408473768,Aj=1.0507009873554805});var _j,Dj,Fj,Oj,Pj,Lj,HE=h(()=>{_j=.3275911,Dj=.254829592,Fj=-.284496736,Oj=1.421413741,Pj=-1.453152027,Lj=1.061405429});function Mj(r,t){if(r.length!==t.length)throw new Error(`Cannot merge real and imag arrays of different lengths. real:${r.length}, imag: ${t.length}.`);let e=new Float32Array(r.length*2);for(let o=0;o<e.length;o+=2)e[o]=r[o/2],e[o+1]=t[o/2];return e}function Bj(r){let t=new Float32Array(r.length/2),e=new Float32Array(r.length/2);for(let o=0;o<r.length;o+=2)t[o/2]=r[o],e[o/2]=r[o+1];return{real:t,imag:e}}function Vj(r){let t=Math.ceil(r.length/4),e=new Float32Array(t),o=new Float32Array(t);for(let n=0;n<r.length;n+=4)e[Math.floor(n/4)]=r[n],o[Math.floor(n/4)]=r[n+1];return{real:e,imag:o}}function zj(r){let t=Math.floor(r.length/4),e=new Float32Array(t),o=new Float32Array(t);for(let n=2;n<r.length;n+=4)e[Math.floor(n/4)]=r[n],o[Math.floor(n/4)]=r[n+1];return{real:e,imag:o}}function Gj(r,t){let e=r[t*2],o=r[t*2+1];return{real:e,imag:o}}function Wj(r,t,e,o){r[o*2]=t,r[o*2+1]=e}function Uj(r,t){let e=new Float32Array(r/2),o=new Float32Array(r/2);for(let n=0;n<Math.ceil(r/2);n++){let s=(t?2:-2)*Math.PI*(n/r);e[n]=Math.cos(s),o[n]=Math.sin(s)}return{real:e,imag:o}}function Hj(r,t,e){let o=(e?2:-2)*Math.PI*(r/t),n=Math.cos(o),s=Math.sin(o);return{real:n,imag:s}}var KE=h(()=>{});function qj(r,t){r=r.replace(/\s/g,"");let e=(r.length-r.replace(Kj,"").length)/Qy.length;if(e<1)throw new Error("Equations without an arrow are not supported.");if(e>1)throw new Error(`Equation must contain exactly one arrow ("${Qy}").`);let[o,n]=r.split(Qy);$(o.indexOf(XE)===-1,()=>`The ellipsis notation ("${XE}") is not supported yet.`);let s=o.split(qE),a=s.length;if(t!==a)throw new Error(`Expected ${a} input tensors, received ${t}`);if(a>2)throw new Error("Support for more than 2 input tensors is not implemented yet.");let i=[];for(let m=0;m<n.length;++m){let f=n[m];if(!s.some(d=>d.indexOf(f)!==-1))throw new Error(`Output subscripts contain the label ${f} not present in the input subscripts.`);i.indexOf(f)===-1&&i.push(f)}for(let m=0;m<o.length;++m){let f=o[m];i.indexOf(f)===-1&&f!==qE&&i.push(f)}let c=new Array(s.length);for(let m=0;m<a;++m){if(new Set(s[m].split("")).size!==s[m].length)throw new Error(`Found duplicate axes in input component ${s[m]}. Support for duplicate axes in input is not implemented yet.`);c[m]=[];for(let f=0;f<s[m].length;++f)c[m].push(i.indexOf(s[m][f]))}let l=i.length,u=n.length,p=[];for(let m=u;m<l;++m)p.push(m);return{allDims:i,summedDims:p,idDims:c}}function Xj(r,t){let e=new Array(r);e.fill(-1);for(let n=0;n<t.length;++n)e[t[n]]=n;let o=[];for(let n=0;n<r;++n)e[n]===-1&&o.push(n);return e=e.filter(n=>n!==-1),{permutationIndices:e,expandDims:o}}function jj(r,t,e){let o=new Array(r);for(let n=0;n<e.length;++n){let s=e[n].shape;for(let a=0;a<t[n].length;++a)o[t[n][a]]===void 0?o[t[n][a]]=s[a]:$(o[t[n][a]]===s[a],()=>`Expected dimension ${o[t[n][a]]} at axis ${a} of input shaped ${JSON.stringify(s)}, but got dimension ${s[a]}`)}}function Yj(r,t){let e=r,o=[],n=0;r.length===0&&e.push(-1),n=r.length+1;for(let a=0;a<n;++a)o.push([]);let s=[];for(let a=0;a<e.length;++a){let i=e[a],c=Qj(t,i);for(let l of c)s.indexOf(l)===-1&&(o[a].push(l),s.push(l))}return{path:e,steps:o}}function Zj(r){return r.every((t,e)=>t===e)}function Qj(r,t){let e=[];for(let o=0;o<r.length;++o)(r[o].length===0||r[o].indexOf(t)!==-1||t===-1)&&e.push(o);return e}var Qy,Kj,qE,XE,jE=h(()=>{Re();Qy="->",Kj=/->/g,qE=",",XE="..."});function Jj(r,t,e=0){let o=[];if(typeof t=="number")$(r.shape[e]%t===0,()=>"Number of splits must evenly divide the axis."),o=new Array(t).fill(r.shape[e]/t);else{let n=t.reduce((a,i)=>(i===-1&&(a+=1),a),0);$(n<=1,()=>"There should be only one negative value in split array.");let s=t.indexOf(-1);if(s!==-1){let a=t.reduce((i,c)=>c>0?i+c:i);t[s]=r.shape[e]-a}$(r.shape[e]===t.reduce((a,i)=>a+i),()=>"The sum of sizes must match the size of the axis dimension."),o=t}return o}var YE=h(()=>{X()});function t5(r){return`Received SparseTensor with denseShape[0] = 0 but
  indices.shape[0] = ${r}`}function e5(r,t){return`indices(${r}, 0) is invalid: ${t} < 0`}function r5(r,t,e){return`indices(${r}, 0) is invalid: ${t} >= ${e}`}var ZE=h(()=>{});function o5(r,t){return`only one output dimension may be -1, not both ${r} and ${t}`}function n5(r,t){return`size ${r} must be non-negative, not ${t}`}function s5(){return"reshape cannot infer the missing input size for an empty tensor unless all specified input sizes are non-zero"}function a5(r,t){let e=$t(r),o=$t(t);return`Input to reshape is a SparseTensor with ${e}
  dense values, but the requested shape requires a multiple of ${o}. inputShape=${r} outputShape= ${t}`}function i5(r,t){let e=$t(r),o=$t(t);return`Input to reshape is a tensor with ${e} dense values, but the requested shape has ${o}. inputShape=${r} outputShape=${t}`}var QE=h(()=>{X();});function c5(){return"segment ids must be >= 0"}function l5(){return"segment ids are not increasing"}function u5(r,t){return`Segment id ${r} out of range [0, ${t}), possibly because segmentIds input is not sorted.`}function p5(r,t,e){return`Bad: indices[${r}] == ${t} out of range [0, ${e})`}var JE=h(()=>{});var Jy={};Yt(Jy,{collectGatherOpShapeInfo:()=>d5,computeOutShape:()=>f5,segOpComputeOptimalWindowSize:()=>m5});function m5(r,t){let e=!1,o;for(r<=Xf?(o=r,e=!0):o=pi(r,Math.floor(Math.sqrt(r)));!e;)o>t||o===r?e=!0:o=pi(r,o+1);return o}function f5(r,t,e){let o=[],n=r.length;for(let s=0;s<n;s++)s!==t?o.push(r[s]):o.push(e);return o}function d5(r,t,e,o){let n=t.shape.length,s=r.shape.length;if(o!==0&&(o<-n||o>n))throw new Error(`Expect batchDims in the range of [-${n}, ${n}], but got ${o}`);if(o<0&&(o+=n),o>s)throw new Error(`batchDims (${o}) must be less than rank(x) (
    ${s}).`);if(e<o)throw new Error(`batchDims (${o}) must be less than or equal to axis (${e}).`);for(let p=0;p<o;++p)if(r.shape[p]!==t.shape[p])throw new Error(`x.shape[${p}]: ${r.shape[p]} should be equal to indices.shape[${p}]: ${t.shape[p]}.`);let a=r.shape[e],i=[],c=1,l=1,u=1;for(let p=0;p<o;++p)i.push(r.shape[p]),c*=r.shape[p];for(let p=o;p<e;p++)i.push(r.shape[p]),l*=r.shape[p];for(let p=o;p<n;p++)i.push(t.shape[p]);for(let p=e+1;p<s;p++)i.push(r.shape[p]),u*=r.shape[p];return{batchSize:c,sliceSize:u,outerSize:l,dimSize:a,outputShape:i}}var t2=h(()=>{X();Zy();});var k={};Yt(k,{ERF_A1:()=>Dj,ERF_A2:()=>Fj,ERF_A3:()=>Oj,ERF_A4:()=>Pj,ERF_A5:()=>Lj,ERF_P:()=>_j,PARALLELIZE_THRESHOLD:()=>Xf,RowPartitionType:()=>Uo,SELU_SCALE:()=>Aj,SELU_SCALEALPHA:()=>Rj,applyActivation:()=>Pa,assertAndGetBroadcastShape:()=>Vt,assertAxesAreInnerMostDims:()=>eK,assertParamsConsistent:()=>xj,assignToTypedArray:()=>Wj,axesAreInnerMostDims:()=>Qx,calculateShapes:()=>u6,checkEinsumDimSizes:()=>jj,checkPadOnDimRoundingMode:()=>ve,combineLocations:()=>wN,combineRaggedTensorToTensorShapes:()=>bj,complexWithEvenIndex:()=>Vj,complexWithOddIndex:()=>zj,computeConv2DInfo:()=>Sa,computeConv3DInfo:()=>uS,computeDefaultPad:()=>Gx,computeDilation2DInfo:()=>JU,computeOptimalWindowSize:()=>Sj,computeOutAndReduceShapes:()=>tK,computeOutShape:()=>yj,computePool2DInfo:()=>zx,computePool3DInfo:()=>tH,convertConv2DDataFormat:()=>pS,decodeEinsumEquation:()=>qj,eitherStridesOrDilationsAreOne:()=>or,expandShapeToKeepDim:()=>cn,exponent:()=>Hj,exponents:()=>Uj,fromStringArrayToUint8:()=>g5,fromUint8ToStringArray:()=>h5,getAxesPermutation:()=>rK,getBroadcastDims:()=>mN,getComplexWithIndex:()=>Gj,getEinsumComputePath:()=>Yj,getEinsumPermutation:()=>Xj,getFusedBiasGradient:()=>Oa,getFusedDyActivation:()=>Fa,getImageCenter:()=>Nj,getInnerMostAxes:()=>nK,getPermuted:()=>Ij,getRaggedRank:()=>wj,getReductionAxes:()=>Em,getReshaped:()=>Tj,getReshapedPermuted:()=>kj,getRowPartitionTypesHelper:()=>vj,getSliceBeginCoords:()=>Ej,getSliceSize:()=>$j,getSparseFillEmptyRowsIndicesDenseShapeMismatch:()=>t5,getSparseFillEmptyRowsNegativeIndexErrorMessage:()=>e5,getSparseFillEmptyRowsOutOfRangeIndexErrorMessage:()=>r5,getSparseReshapeEmptyTensorZeroOutputDimErrorMessage:()=>s5,getSparseReshapeInputOutputMismatchErrorMessage:()=>i5,getSparseReshapeInputOutputMultipleErrorMessage:()=>a5,getSparseReshapeMultipleNegativeOneOutputDimErrorMessage:()=>o5,getSparseReshapeNegativeOutputDimErrorMessage:()=>n5,getSparseSegmentReductionIndicesOutOfRangeErrorMessage:()=>p5,getSparseSegmentReductionNegativeSegmentIdsErrorMessage:()=>c5,getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage:()=>l5,getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage:()=>u5,getUndoAxesPermutation:()=>oK,isIdentityPermutation:()=>Zj,log:()=>K4,mergeRealAndImagArrays:()=>Mj,prepareAndValidate:()=>sj,prepareSplitSize:()=>Jj,segment_util:()=>Jy,shouldFuse:()=>La,slice_util:()=>Fe,splitRealAndImagArrays:()=>Bj,stridesOrDilationsArePositive:()=>Oo,tupleValuesAreOne:()=>Ca,upcastType:()=>be,validateDefaultValueShape:()=>Cj,validateInput:()=>Uu,validateUpdateShape:()=>K1,warn:()=>tn});function h5(r){try{return r.map(t=>Yc(t))}catch(t){throw new Error(`Failed to decode encoded string bytes into utf-8, error: ${t}`)}}function g5(r){return r.map(t=>jc(t))}var e2=h(()=>{X();cl();_e();BE();gr();gl();VE();zE();Zy();jy();Qc();GE();WE();kE();kf();UE();gl();HE();Jp();KE();jE();YE();ZE();QE();JE();t2();});var Ye={};Yt(Ye,{nonMaxSuppressionV3Impl:()=>Ff,nonMaxSuppressionV4Impl:()=>Of,nonMaxSuppressionV5Impl:()=>Pf,whereImpl:()=>$f});var r2=h(()=>{qu();Ry();});var o2=h(()=>{CE();_e();IE();jy();X();Kr();Qc();Xu();LE();Ar();rm();Ke();ME();e2();wx();r2();Ug();H();});var I=h(()=>{BC();cE();o2();iE()});function n2(r,t){za[r]=t}function Dr(r,t){if(!(r in za)||t!=null){let o=y5(r,t);if(o!==null)za[r]=o;else return console.log("Could not get context for WebGL version",r),null}let e=za[r];return e==null||e.isContextLost()?(delete za[r],Dr(r)):(e.disable(e.DEPTH_TEST),e.disable(e.STENCIL_TEST),e.disable(e.BLEND),e.disable(e.DITHER),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SAMPLE_COVERAGE),e.enable(e.SCISSOR_TEST),e.enable(e.CULL_FACE),e.cullFace(e.BACK),za[r])}function x5(r){if(!O().getBool("IS_SAFARI")&&typeof OffscreenCanvas!="undefined"&&r===2)return new OffscreenCanvas(300,150);if(typeof document!="undefined")return document.createElement("canvas");throw new Error("Cannot create a canvas in this context")}function y5(r,t){if(r!==1&&r!==2)throw new Error("Cannot get WebGL rendering context, WebGL is disabled.");let e=t==null?x5(r):t;return e.addEventListener("webglcontextlost",o=>{o.preventDefault(),delete za[r]},!1),O().getBool("SOFTWARE_WEBGL_ENABLED")&&(Yf.failIfMajorPerformanceCaveat=!1),r===1?e.getContext("webgl",Yf)||e.getContext("experimental-webgl",Yf):e.getContext("webgl2",Yf)}var za,Yf,Zf=h(()=>{I();za={},Yf={alpha:!1,antialias:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,depth:!1,stencil:!1,failIfMajorPerformanceCaveat:!0}});function Ga(r,t){return[t,r]}function s2(r,t){return r*t}function Ju(r){let t=b.sizeFromShape(r),e=Math.ceil(t/4);return b.sizeToSquarishShape(e)}function Ho(r,t){return[Math.max(1,Math.ceil(t/2)),Math.max(1,Math.ceil(r/2))]}function a2(r,t){let[e,o]=Ho(r,t);return e*o*4}function tp(r,t){let e=r,o,n,s,a,i,c,l,u,p,m;return O().getNumber("WEBGL_VERSION")===2?(o=e.R32F,n=e.R16F,s=e.RGBA16F,a=e.RGBA32F,i=e.RED,l=4,u=1,p=e.HALF_FLOAT,m=e.FLOAT,c=e.RGBA8):(o=r.RGBA,n=r.RGBA,s=r.RGBA,a=e.RGBA,i=r.RGBA,l=4,u=4,p=t!=null?t.HALF_FLOAT_OES:null,m=r.FLOAT,c=r.RGBA),{internalFormatFloat:o,internalFormatHalfFloat:n,internalFormatPackedHalfFloat:s,internalFormatPackedFloat:a,textureFormatFloat:i,downloadTextureFormat:c,downloadUnpackNumChannels:l,defaultNumChannels:u,textureTypeHalfFloat:p,textureTypeFloat:m}}var Zn,Ze,Ge,ao=h(()=>{I();(function(r){r[r.DENSE=0]="DENSE",r[r.SHARED_BATCH=1]="SHARED_BATCH"})(Zn||(Zn={}));(function(r){r[r.RENDER=0]="RENDER",r[r.UPLOAD=1]="UPLOAD",r[r.PIXELS=2]="PIXELS",r[r.DOWNLOAD=3]="DOWNLOAD"})(Ze||(Ze={}));(function(r){r[r.UNPACKED_FLOAT16=0]="UNPACKED_FLOAT16",r[r.UNPACKED_FLOAT32=1]="UNPACKED_FLOAT32",r[r.PACKED_4X1_UNSIGNED_BYTE=2]="PACKED_4X1_UNSIGNED_BYTE",r[r.PACKED_2X2_FLOAT32=3]="PACKED_2X2_FLOAT32",r[r.PACKED_2X2_FLOAT16=4]="PACKED_2X2_FLOAT16"})(Ge||(Ge={}))});function ct(r,t){let e=t();return O().getBool("DEBUG")&&b5(r),e}function b5(r){let t=r.getError();if(t!==r.NO_ERROR)throw new Error("WebGL Error: "+C5(r,t))}function i2(r){return!!(O().getBool("WEBGL_RENDER_FLOAT32_ENABLED")||r===0||v5<Math.abs(r)&&Math.abs(r)<w5)}function C5(r,t){switch(t){case r.NO_ERROR:return"NO_ERROR";case r.INVALID_ENUM:return"INVALID_ENUM";case r.INVALID_VALUE:return"INVALID_VALUE";case r.INVALID_OPERATION:return"INVALID_OPERATION";case r.INVALID_FRAMEBUFFER_OPERATION:return"INVALID_FRAMEBUFFER_OPERATION";case r.OUT_OF_MEMORY:return"OUT_OF_MEMORY";case r.CONTEXT_LOST_WEBGL:return"CONTEXT_LOST_WEBGL";default:return`Unknown error code ${t}`}}function ep(r,t){return gn(r,()=>r.getExtension(t),'Extension "'+t+'" not supported on this browser.')}function c2(r,t){let e=gn(r,()=>r.createShader(r.VERTEX_SHADER),"Unable to create vertex WebGLShader.");if(ct(r,()=>r.shaderSource(e,t)),ct(r,()=>r.compileShader(e)),r.getShaderParameter(e,r.COMPILE_STATUS)===!1)throw console.log(r.getShaderInfoLog(e)),new Error("Failed to compile vertex shader.");return e}function l2(r,t){let e=gn(r,()=>r.createShader(r.FRAGMENT_SHADER),"Unable to create fragment WebGLShader.");if(ct(r,()=>r.shaderSource(e,t)),ct(r,()=>r.compileShader(e)),O().get("ENGINE_COMPILE_ONLY"))return e;if(r.getShaderParameter(e,r.COMPILE_STATUS)===!1)throw nb(t,r.getShaderInfoLog(e)),new Error("Failed to compile fragment shader.");return e}function nb(r,t){let e=S5.exec(t);if(e==null){console.log(`Couldn't parse line number in error: ${t}`),console.log(r);return}let o=+e[1],n=r.split(`
`),s=n.length.toString().length+2,a=n.map((p,m)=>b.rightPad((m+1).toString(),s)+p),i=0;for(let p=0;p<a.length;p++)i=Math.max(a[p].length,i);let c=a.slice(0,o-1),l=a.slice(o-1,o),u=a.slice(o);console.log(c.join(`
`)),console.log(t.split(`
`)[0]),console.log(`%c ${b.rightPad(l[0],i)}`,"border:1px solid red; background-color:#e3d2d2; color:#a61717"),console.log(u.join(`
`))}function u2(r){return gn(r,()=>r.createProgram(),"Unable to create WebGLProgram.")}function p2(r,t){if(ct(r,()=>r.linkProgram(t)),!O().get("ENGINE_COMPILE_ONLY")&&r.getProgramParameter(t,r.LINK_STATUS)===!1)throw console.log(r.getProgramInfoLog(t)),new Error("Failed to link vertex and fragment shaders.")}function Jf(r,t){if(ct(r,()=>r.validateProgram(t)),r.getProgramParameter(t,r.VALIDATE_STATUS)===!1)throw console.log(r.getProgramInfoLog(t)),new Error("Shader program validation failed.")}function m2(r,t){let e=gn(r,()=>r.createBuffer(),"Unable to create WebGLBuffer");return ct(r,()=>r.bindBuffer(r.ARRAY_BUFFER,e)),ct(r,()=>r.bufferData(r.ARRAY_BUFFER,t,r.STATIC_DRAW)),e}function f2(r,t){let e=gn(r,()=>r.createBuffer(),"Unable to create WebGLBuffer");return ct(r,()=>r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,e)),ct(r,()=>r.bufferData(r.ELEMENT_ARRAY_BUFFER,t,r.STATIC_DRAW)),e}function d2(r){return gn(r,()=>r.createTexture(),"Unable to create WebGLTexture.")}function h2(r,t){let e=O().getNumber("WEBGL_MAX_TEXTURE_SIZE");if(r<=0||t<=0){let o=`[${r}x${t}]`;throw new Error("Requested texture size "+o+" is invalid.")}if(r>e||t>e){let o=`[${r}x${t}]`,n=`[${e}x${e}]`;throw new Error("Requested texture size "+o+" greater than WebGL maximum on this browser / GPU "+n+".")}}function g2(r){return gn(r,()=>r.createFramebuffer(),"Unable to create WebGLFramebuffer.")}function sb(r,t,e,o,n,s,a){let i=r.getAttribLocation(t,e);return i===-1?!1:(ct(r,()=>r.bindBuffer(r.ARRAY_BUFFER,o)),ct(r,()=>r.vertexAttribPointer(i,n,r.FLOAT,!1,s,a)),ct(r,()=>r.enableVertexAttribArray(i)),!0)}function N5(r,t,e){I5(r,e),ct(r,()=>r.activeTexture(r.TEXTURE0+e)),ct(r,()=>r.bindTexture(r.TEXTURE_2D,t))}function x2(r,t,e){return gn(r,()=>r.getUniformLocation(t,e),'uniform "'+e+'" not present in program.')}function y2(r,t,e){return r.getUniformLocation(t,e)}function b2(r,t,e,o){ct(r,()=>N5(r,t,o)),ct(r,()=>r.uniform1i(e,o))}function td(r,t,e){ct(r,()=>r.bindFramebuffer(r.FRAMEBUFFER,e)),ct(r,()=>r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,t,0))}function ab(r,t){ct(r,()=>r.bindFramebuffer(r.FRAMEBUFFER,t)),ct(r,()=>r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,null,0))}function rp(r){let t=r.checkFramebufferStatus(r.FRAMEBUFFER);if(t!==r.FRAMEBUFFER_COMPLETE)throw new Error("Error binding framebuffer: "+T5(r,t))}function T5(r,t){switch(t){case r.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:return"FRAMEBUFFER_INCOMPLETE_ATTACHMENT";case r.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:return"FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";case r.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:return"FRAMEBUFFER_INCOMPLETE_DIMENSIONS";case r.FRAMEBUFFER_UNSUPPORTED:return"FRAMEBUFFER_UNSUPPORTED";default:return`unknown error ${t}`}}function gn(r,t,e){let o=ct(r,()=>t());if(o==null)throw new Error(e);return o}function I5(r,t){let e=r.MAX_COMBINED_TEXTURE_IMAGE_UNITS-1,o=t+r.TEXTURE0;if(o<r.TEXTURE0||o>e){let n=`[gl.TEXTURE0, gl.TEXTURE${e}]`;throw new Error(`textureUnit must be in ${n}.`)}}function Qn(r,t=2){return b.sizeFromShape(r.slice(0,r.length-t))}function Jn(r){if(r.length===0)throw Error("Cannot get rows and columns of an empty shape array.");return[r.length>1?r[r.length-2]:1,r[r.length-1]]}function op(r){let t=[1,1,1];return r.length===0||r.length===1&&r[0]===1||(t=[Qn(r),...Jn(r)]),t}function v2(r,t=!1){let e=O().getNumber("WEBGL_MAX_TEXTURE_SIZE"),o=O().getNumber("WEBGL_MAX_SIZE_FOR_NARROW_TEXTURE");o===1/0&&O().getBool("WEBGL_AUTO_SQUARIFY_NARROW_TEXTURE_SHAPE")&&(o=e/2),t&&(e=e*2,o=o*2,r=r.map((i,c)=>c>=r.length-2?b.nearestLargerEven(r[c]):r[c]),r.length===1&&(r=[2,r[0]])),r.length!==2&&(r=b.squeezeShape(r).newShape);let n=b.sizeFromShape(r),s=null;r.length<=1&&n<=e?s=[1,n]:r.length===2&&r[0]<=e&&r[1]<=e?s=r:r.length===3&&r[0]*r[1]<=e&&r[2]<=e?s=[r[0]*r[1],r[2]]:r.length===3&&r[0]<=e&&r[1]*r[2]<=e?s=[r[0],r[1]*r[2]]:r.length===4&&r[0]*r[1]*r[2]<=e&&r[3]<=e?s=[r[0]*r[1]*r[2],r[3]]:r.length===4&&r[0]<=e&&r[1]*r[2]*r[3]<=e&&(s=[r[0],r[1]*r[2]*r[3]]);let a=s!=null&&Math.max(...s)>o&&Math.min(...s)<=(t?2:1)&&Math.min(...s)>0;if(s==null||a)if(t){let i=Qn(r),c=2,l=2;r.length&&([c,l]=Jn(r)),n=i*(c/2)*(l/2),s=b.sizeToSquarishShape(n).map(u=>u*2)}else s=b.sizeToSquarishShape(n);return s}function Qf(r){return r%2===0}function Wa(r,t){if(r=r.slice(-2),t=t.slice(-2),b.arraysEqual(r,t)||!r.length||!t.length||r[0]===0||r[1]===0||t[0]===0||t[1]===0)return!0;if(r.length!==t.length){let e=r[r.length-1],o=t[t.length-1];if(e===o||Qf(e)&&Qf(o)&&(r[0]===1||t[0]===1))return!0}return r[1]===t[1]&&Qf(r[0])&&Qf(t[0])}function w2(r){if(eb==null){let t=Dr(r);eb=t.getParameter(t.MAX_TEXTURE_SIZE)}return eb}function C2(r){if(rb==null){let t=Dr(r);rb=t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS)}return Math.min(16,rb)}function S2(r){if(r===0)return 0;let t,e=Dr(r);return Zr(e,"EXT_disjoint_timer_query_webgl2")&&r===2?t=2:Zr(e,"EXT_disjoint_timer_query")?t=1:t=0,t}function Zr(r,t){return r.getExtension(t)!=null}function ib(r){try{if(Dr(r)!=null)return!0}catch(t){return console.log("Error when getting WebGL context: ",t),!1}return!1}function N2(r){if(r===0)return!1;let t=Dr(r);if(r===1){if(!Zr(t,"OES_texture_float"))return!1}else if(!Zr(t,"EXT_color_buffer_float"))return!1;return ob(t)}function T2(r){if(r===0)return!1;let t=Dr(r);if(r===1){if(!Zr(t,"OES_texture_float")||!Zr(t,"WEBGL_color_buffer_float"))return!1}else{if(Zr(t,"EXT_color_buffer_float"))return ob(t);let o="EXT_color_buffer_half_float";if(Zr(t,o)){let n=t.getExtension(o);return k5(t,n)}return!1}return ob(t)}function ob(r){let t=tp(r),e=r.createTexture();r.bindTexture(r.TEXTURE_2D,e),r.texImage2D(r.TEXTURE_2D,0,t.internalFormatFloat,1,1,0,t.textureFormatFloat,t.textureTypeFloat,null);let s=r.createFramebuffer();r.bindFramebuffer(r.FRAMEBUFFER,s),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,e,0);let a=r.checkFramebufferStatus(r.FRAMEBUFFER)===r.FRAMEBUFFER_COMPLETE;return r.bindTexture(r.TEXTURE_2D,null),r.bindFramebuffer(r.FRAMEBUFFER,null),r.deleteTexture(e),r.deleteFramebuffer(s),a}function k5(r,t){let e=tp(r,t),o=r.createTexture();r.bindTexture(r.TEXTURE_2D,o),r.texImage2D(r.TEXTURE_2D,0,e.internalFormatHalfFloat,1,1,0,e.textureFormatFloat,e.textureTypeHalfFloat,null);let a=r.createFramebuffer();r.bindFramebuffer(r.FRAMEBUFFER,a),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,o,0);let i=r.checkFramebufferStatus(r.FRAMEBUFFER)===r.FRAMEBUFFER_COMPLETE;return r.bindTexture(r.TEXTURE_2D,null),r.bindFramebuffer(r.FRAMEBUFFER,null),r.deleteTexture(o),r.deleteFramebuffer(a),i}function I2(r){return r!==2?!1:Dr(r).fenceSync!=null}function Ko(r,t){Array.isArray(r)||(r=[r]),r.forEach(e=>{e!=null&&b.assert(e.dtype!=="complex64",()=>`${t} does not support complex64 tensors in the WebGL backend.`)})}var v5,w5,S5,eb,rb,Fr=h(()=>{I();Zf();ao();v5=596e-10,w5=65504;S5=/ERROR: [0-9]+:([0-9]+):/g});var dt,k2=h(()=>{I();Fr();dt=O();dt.registerFlag("HAS_WEBGL",()=>dt.getNumber("WEBGL_VERSION")>0);dt.registerFlag("WEBGL_VERSION",()=>ib(2)?2:ib(1)?1:0);dt.registerFlag("WEBGL_CHECK_NUMERICAL_PROBLEMS",()=>!1);dt.registerFlag("WEBGL_BUFFER_SUPPORTED",()=>dt.get("WEBGL_VERSION")===2);dt.registerFlag("WEBGL_CPU_FORWARD",()=>!0);dt.registerFlag("WEBGL_FORCE_F16_TEXTURES",()=>!1);dt.registerFlag("WEBGL_PACK",()=>dt.getBool("HAS_WEBGL"));dt.registerFlag("WEBGL_PACK_NORMALIZATION",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_CLIP",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_DEPTHWISECONV",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_BINARY_OPERATIONS",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_UNARY_OPERATIONS",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_ARRAY_OPERATIONS",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_IMAGE_OPERATIONS",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_REDUCE",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_LAZILY_UNPACK",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_CONV_IM2COL",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_PACK_CONV2DTRANSPOSE",()=>dt.getBool("WEBGL_PACK"));dt.registerFlag("WEBGL_MAX_TEXTURE_SIZE",()=>w2(dt.getNumber("WEBGL_VERSION")));dt.registerFlag("WEBGL_MAX_TEXTURES_IN_SHADER",()=>C2(dt.getNumber("WEBGL_VERSION")));dt.registerFlag("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION",()=>{let r=dt.getNumber("WEBGL_VERSION");return r===0?0:S2(r)});dt.registerFlag("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE",()=>dt.getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")>0&&!Fn.isMobile());dt.registerFlag("WEBGL_RENDER_FLOAT32_CAPABLE",()=>N2(dt.getNumber("WEBGL_VERSION")));dt.registerFlag("WEBGL_RENDER_FLOAT32_ENABLED",()=>dt.getBool("WEBGL_FORCE_F16_TEXTURES")?!1:dt.getBool("WEBGL_RENDER_FLOAT32_CAPABLE"));dt.registerFlag("WEBGL_DOWNLOAD_FLOAT_ENABLED",()=>T2(dt.getNumber("WEBGL_VERSION")));dt.registerFlag("WEBGL_FENCE_API_ENABLED",()=>I2(dt.getNumber("WEBGL_VERSION")));dt.registerFlag("WEBGL_SIZE_UPLOAD_UNIFORM",()=>dt.getBool("WEBGL_RENDER_FLOAT32_ENABLED")?4:0);dt.registerFlag("WEBGL_DELETE_TEXTURE_THRESHOLD",()=>-1,r=>{if(typeof r!="number")throw new Error(`WEBGL_DELETE_TEXTURE_THRESHOLD must be a number but got ${r}.`);if(r<0&&r!==-1)throw new Error(`WEBGL_DELETE_TEXTURE_THRESHOLD must be -1 (indicating never delete) or at least 0, but got ${r}.`)});dt.registerFlag("WEBGL_FLUSH_THRESHOLD",()=>Fn.isMobile()?1:-1,r=>{if(typeof r!="number")throw new Error(`WEBGL_FLUSH_THRESHOLD must be a number but got ${r}.`);if(r<0&&r!==-1)throw new Error(`WEBGL_FLUSH_THRESHOLD must be -1 (indicating never manual flush) or at least 0, but got ${r}.`)});dt.registerFlag("CPU_HANDOFF_SIZE_THRESHOLD",()=>128);dt.registerFlag("WEBGL_USE_SHAPES_UNIFORMS",()=>!1);dt.registerFlag("TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD",()=>1e5);dt.registerFlag("TOPK_K_CPU_HANDOFF_THRESHOLD",()=>128);dt.registerFlag("WEBGL_EXP_CONV",()=>!1);dt.registerFlag("SOFTWARE_WEBGL_ENABLED",()=>dt.getBool("IS_TEST"));dt.registerFlag("WEBGL_MAX_SIZE_FOR_NARROW_TEXTURE",()=>1/0);dt.registerFlag("WEBGL_AUTO_SQUARIFY_NARROW_TEXTURE_SHAPE",()=>!1);dt.registerFlag("WEBGL2_ISNAN_CUSTOM",()=>!1);dt.registerFlag("ENGINE_COMPILE_ONLY",()=>!1)});function ie(){let r,t,e,o,n,s,a,i,c,l;return O().getNumber("WEBGL_VERSION")===2?(r="#version 300 es",t="in",e="out",o="in",n="texture",s="outputColor",a="out vec4 outputColor;",i=O().getBool("WEBGL2_ISNAN_CUSTOM")?`
      bool isnan_custom(float val) {
        uint floatToUint = floatBitsToUint(val);
        return (floatToUint & 0x7fffffffu) > 0x7f800000u;
      }

      bvec4 isnan_custom(vec4 val) {
        return bvec4(isnan_custom(val.x),
          isnan_custom(val.y), isnan_custom(val.z), isnan_custom(val.w));
      }

      #define isnan(value) isnan_custom(value)
    `:"",c="",l=`
      #define round(value) newRound(value)
      int newRound(float value) {
        return int(floor(value + 0.5));
      }

      ivec4 newRound(vec4 value) {
        return ivec4(floor(value + vec4(0.5)));
      }
    `):(r="",t="attribute",e="varying",o="varying",n="texture2D",s="gl_FragColor",a="",i=`
      #define isnan(value) isnan_custom(value)
      bool isnan_custom(float val) {
        return (val > 0. || val < 1. || val == 0.) ? false : true;
      }
      bvec4 isnan_custom(vec4 val) {
        return bvec4(isnan(val.x), isnan(val.y), isnan(val.z), isnan(val.w));
      }
    `,c=`
      uniform float INFINITY;

      bool isinf(float val) {
        return abs(val) == INFINITY;
      }
      bvec4 isinf(vec4 val) {
        return equal(abs(val), vec4(INFINITY));
      }
    `,l=`
      int round(float value) {
        return int(floor(value + 0.5));
      }

      ivec4 round(vec4 value) {
        return ivec4(floor(value + vec4(0.5)));
      }
    `),{version:r,attribute:t,varyingVs:e,varyingFs:o,texture2D:n,output:s,defineOutput:a,defineSpecialNaN:i,defineSpecialInf:c,defineRound:l}}var io=h(()=>{I();});function wo(r,t,e="index"){let o=b.computeStrides(t);return o.map((n,s)=>{let a=`int ${r[s]} = ${e} / ${n}`,i=s===o.length-1?`int ${r[s+1]} = ${e} - ${r[s]} * ${n}`:`index -= ${r[s]} * ${n}`;return`${a}; ${i};`}).join("")}function Ua(r,t,e="index"){let o=b.computeStrides(t);return o.map((n,s)=>{let a=`int ${r[s]} = ${e} / outShapeStrides[${s}]`,i=s===o.length-1?`int ${r[s+1]} = ${e} - ${r[s]} * outShapeStrides[${s}]`:`index -= ${r[s]} * outShapeStrides[${s}]`;return`${a}; ${i};`}).join("")}function E5(r,t){let e=r.length,o=r.map(s=>`${t}[${s}]`),n=new Array(e-1);n[e-2]=o[e-1];for(let s=e-3;s>=0;--s)n[s]=`(${n[s+1]} * ${o[s+1]})`;return n}function E2(r,t,e="index"){let o=r.map((s,a)=>a),n=E5(o,t);return n.map((s,a)=>{let i=`int ${r[a]} = ${e} / ${n[a]}`,c=a===n.length-1?`int ${r[a+1]} = ${e} - ${r[a]} * ${n[a]}`:`index -= ${r[a]} * ${n[a]}`;return`${i}; ${c};`}).join("")}function bl(r){let t=b.computeStrides(r).map(e=>e.toString());return`
  int getFlatIndex(ivec3 coords) {
    return coords.x * ${t[0]} + coords.y * ${t[1]} + coords.z;
  }
`}function vl(){return`
  int getFlatIndex(ivec3 coords) {
    return coords.x * outShapeStrides[0] + coords.y * outShapeStrides[1] + coords.z;
  }
`}var rd,xn=h(()=>{I();rd=`
  const float FLOAT_MAX = 1.70141184e38;
  const float FLOAT_MIN = 1.17549435e-38;

  lowp vec4 encode_float(highp float v) {
    if (isnan(v)) {
      return vec4(255, 255, 255, 255);
    }

    highp float av = abs(v);

    if(av < FLOAT_MIN) {
      return vec4(0.0, 0.0, 0.0, 0.0);
    } else if(v > FLOAT_MAX) {
      return vec4(0.0, 0.0, 128.0, 127.0) / 255.0;
    } else if(v < -FLOAT_MAX) {
      return vec4(0.0, 0.0,  128.0, 255.0) / 255.0;
    }

    highp vec4 c = vec4(0,0,0,0);

    highp float e = floor(log2(av));
    highp float m = exp2(fract(log2(av))) - 1.0;

    c[2] = floor(128.0 * m);
    m -= c[2] / 128.0;
    c[1] = floor(32768.0 * m);
    m -= c[1] / 32768.0;
    c[0] = floor(8388608.0 * m);

    highp float ebias = e + 127.0;
    c[3] = floor(ebias / 2.0);
    ebias -= c[3] * 2.0;
    c[2] += floor(ebias) * 128.0;

    c[3] += 128.0 * step(0.0, -v);

    return c / 255.0;
  }
`});function R2(r,t,e){let o=[];if(r.forEach(f=>{let d=b.sizeFromShape(f.shapeInfo.logicalShape);if(f.shapeInfo.isUniform?o.push(`uniform float ${f.name}${d>1?`[${d}]`:""};`):(o.push(`uniform sampler2D ${f.name};`),o.push(`uniform int offset${f.name};`)),e.enableShapeUniforms){let{uniformShape:x}=od(e.packedInputs,f.shapeInfo.logicalShape,f.shapeInfo.texShape);switch(x.length){case 1:o.push(`uniform int ${f.name}Shape;`);break;case 2:o.push(`uniform ivec2 ${f.name}Shape;`);break;case 3:o.push(`uniform ivec3 ${f.name}Shape;`);break;case 4:o.push(`uniform ivec4 ${f.name}Shape;`);break;default:break}o.push(`uniform ivec2 ${f.name}TexShape;`)}}),e.enableShapeUniforms){switch(t.logicalShape.length){case 1:o.push("uniform int outShape;");break;case 2:o.push("uniform ivec2 outShape;"),o.push("uniform int outShapeStrides;");break;case 3:o.push("uniform ivec3 outShape;"),o.push("uniform ivec2 outShapeStrides;");break;case 4:o.push("uniform ivec4 outShape;"),o.push("uniform ivec3 outShapeStrides;");break;default:break}o.push("uniform ivec2 outTexShape;")}e.customUniforms&&e.customUniforms.forEach(f=>{o.push(`uniform ${f.type} ${f.name}${f.arrayIndex?`[${f.arrayIndex}]`:""};`)});let n=o.join(`
`),s=r.map(f=>$5(f,t,e.packedInputs,e.enableShapeUniforms)).join(`
`),a=t.texShape,i=ie(),c=_5(i),l,u,p=O5(i);return t.isPacked?(l=R5(t.logicalShape,a,e.enableShapeUniforms),u=F5(i)):(l=A5(t.logicalShape,a,e.enableShapeUniforms),u=D5(i)),e.packedInputs&&(p+=B5),[p,c,u,n,l,s,e.userCode].join(`
`)}function Cl(r,t=!1){let e=r.shapeInfo.logicalShape;switch(e.length){case 0:return Z5(r,t);case 1:return J5(r,t);case 2:return e8(r,t);case 3:return o8(r,t);case 4:return s8(r,t);case 5:return a8(r);case 6:return i8(r);default:throw new Error(`${e.length}-D input sampling is not yet supported`)}}function A2(r,t){switch(r.shapeInfo.logicalShape.length){case 0:return Y5(r);case 1:return Q5(r,t);case 2:return t8(r,t);case 3:return r8(r,t);default:return n8(r,t)}}function $5(r,t,e=!1,o){let n="";e?n+=A2(r,o):n+=Cl(r,o);let s=r.shapeInfo.logicalShape,a=t.logicalShape;return s.length<=a.length&&(e?n+=c8(r,t):n+=l8(r,t)),n}function R5(r,t,e){switch(r.length){case 0:return _2();case 1:return V5(r,t,e);case 2:return X5(r,t,e);case 3:return G5(r,t,e);default:return U5(r,t,e)}}function A5(r,t,e){switch(r.length){case 0:return _2();case 1:return z5(r,t,e);case 2:return j5(r,t,e);case 3:return W5(r,t,e);case 4:return H5(r,t,e);case 5:return K5(r,t);case 6:return q5(r,t);default:throw new Error(`${r.length}-D output sampling is not yet supported`)}}function _5(r){return`
    float sampleTexture(sampler2D textureSampler, vec2 uv) {
      return ${r.texture2D}(textureSampler, uv).r;
    }
  `}function D5(r){return`
    void setOutput(float val) {
      ${r.output} = vec4(val, 0, 0, 0);
    }
  `}function F5(r){return`
    void setOutput(vec4 val) {
      ${r.output} = val;
    }
  `}function O5(r){return`${r.version}
    precision highp float;
    precision highp int;
    precision highp sampler2D;
    ${r.varyingFs} vec2 resultUV;
    ${r.defineOutput}
    const vec2 halfCR = vec2(0.5, 0.5);

    struct ivec5
    {
      int x;
      int y;
      int z;
      int w;
      int u;
    };

    struct ivec6
    {
      int x;
      int y;
      int z;
      int w;
      int u;
      int v;
    };

    uniform float NAN;
    ${r.defineSpecialNaN}
    ${r.defineSpecialInf}
    ${r.defineRound}

    int imod(int x, int y) {
      return x - y * (x / y);
    }

    int idiv(int a, int b, float sign) {
      int res = a / b;
      int mod = imod(a, b);
      if (sign < 0. && mod != 0) {
        res -= 1;
      }
      return res;
    }

    //Based on the work of Dave Hoskins
    //https://www.shadertoy.com/view/4djSRW
    #define HASHSCALE1 443.8975
    float random(float seed){
      vec2 p = resultUV * seed;
      vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }

    ${P5}
    ${L5}
    ${M5}
  `}function _2(){return`
    int getOutputCoords() {
      return 0;
    }
  `}function V5(r,t,e){let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)];return o[0]===1?e?`
      int getOutputCoords() {
        return 2 * int(resultUV.x * ceil(float(outTexShape[1]) / 2.0));
      }
    `:`
      int getOutputCoords() {
        return 2 * int(resultUV.x * ${o[1]}.0);
      }
    `:o[1]===1?e?`
      int getOutputCoords() {
        return 2 * int(resultUV.y * ceil(float(outTexShape[0]) / 2.0));
      }
    `:`
      int getOutputCoords() {
        return 2 * int(resultUV.y * ${o[0]}.0);
      }
    `:e?`
    int getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      return 2 * (resTexRC.x * packedTexShape[1] + resTexRC.y);
    }
  `:`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      return 2 * (resTexRC.x * ${o[1]} + resTexRC.y);
    }
  `}function z5(r,t,e){return t[0]===1?e?`
      int getOutputCoords() {
        return int(resultUV.x * float(outTexShape[1]));
      }
    `:`
      int getOutputCoords() {
        return int(resultUV.x * ${t[1]}.0);
      }
    `:t[1]===1?e?`
      int getOutputCoords() {
        return int(resultUV.y * float(outTexShape[0]));
      }
    `:`
      int getOutputCoords() {
        return int(resultUV.y * ${t[0]}.0);
      }
    `:e?`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(outTexShape[0], outTexShape[1]));
      return resTexRC.x * outTexShape[1] + resTexRC.y;
    }
  `:`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      return resTexRC.x * ${t[1]} + resTexRC.y;
    }
  `}function G5(r,t,e){if(e)return`
    ivec3 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      int texelsInLogicalRow = int(ceil(float(outShape[2]) / 2.0));
      int texelsInBatch = texelsInLogicalRow * int(ceil(float(outShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;

      int b = index / texelsInBatch;
      index -= b * texelsInBatch;

      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec3(b, r, c);
    }
  `;let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)],n=Math.ceil(r[2]/2),s=n*Math.ceil(r[1]/2);return`
    ivec3 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      int index = resTexRC.x * ${o[1]} + resTexRC.y;

      int b = index / ${s};
      index -= b * ${s};

      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec3(b, r, c);
    }
  `}function W5(r,t,e){if(e)return`
  ivec3 getOutputCoords() {
    ivec2 resTexRC = ivec2(resultUV.yx *
                           vec2(outTexShape[0], outTexShape[1]));
    int index = resTexRC.x * outTexShape[1] + resTexRC.y;
    ${Ua(["r","c","d"],r)}
    return ivec3(r, c, d);
  }
`;let o=wo(["r","c","d"],r);return`
    ivec3 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      ${o}
      return ivec3(r, c, d);
    }
  `}function U5(r,t,e){if(e)return`
    ivec4 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;

      int texelsInLogicalRow = int(ceil(float(outShape[3]) / 2.0));
      int texelsInBatch = texelsInLogicalRow * int(ceil(float(outShape[2]) / 2.0));
      int texelsInBatchN = texelsInBatch * outShape[1];

      int b2 = index / texelsInBatchN;
      index -= b2 * texelsInBatchN;

      int b = index / texelsInBatch;
      index -= b * texelsInBatch;

      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec4(b2, b, r, c);
    }
  `;let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)],n=Math.ceil(r[r.length-1]/2),s=n*Math.ceil(r[r.length-2]/2),a=s,i="",c="b, r, c";for(let l=2;l<r.length-1;l++)a*=r[r.length-l-1],i=`
      int b${l} = index / ${a};
      index -= b${l} * ${a};
    `+i,c=`b${l}, `+c;return`
    ivec${r.length} getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      int index = resTexRC.x * ${o[1]} + resTexRC.y;

      ${i}

      int b = index / ${s};
      index -= b * ${s};

      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec${r.length}(${c});
    }
  `}function H5(r,t,e){if(e)return`
    ivec4 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(outTexShape[0], outTexShape[1]));
      int index = resTexRC.x * outTexShape[1] + resTexRC.y;
      ${Ua(["r","c","d","d2"],r)}
      return ivec4(r, c, d, d2);
    }
  `;let o=wo(["r","c","d","d2"],r);return`
    ivec4 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      ${o}
      return ivec4(r, c, d, d2);
    }
  `}function K5(r,t){let e=wo(["r","c","d","d2","d3"],r);return`
    ivec5 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx * vec2(${t[0]},
                             ${t[1]}));

      int index = resTexRC.x * ${t[1]} + resTexRC.y;

      ${e}

      ivec5 outShape = ivec5(r, c, d, d2, d3);
      return outShape;
    }
  `}function q5(r,t){let e=wo(["r","c","d","d2","d3","d4"],r);return`
    ivec6 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;

      ${e}

      ivec6 result = ivec6(r, c, d, d2, d3, d4);
      return result;
    }
  `}function X5(r,t,e){let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)];if(b.arraysEqual(r,t))return e?`
      ivec2 getOutputCoords() {
        ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
        return 2 * ivec2(resultUV.yx * vec2(packedTexShape[0], packedTexShape[1]));
      }
    `:`
      ivec2 getOutputCoords() {
        return 2 * ivec2(resultUV.yx * vec2(${o[0]}, ${o[1]}));
      }
    `;let n=Math.ceil(r[1]/2);return e?`
    ivec2 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      int texelsInLogicalRow = int(ceil(float(outShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));

      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;
      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec2(r, c);
    }
  `:`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));

      int index = resTexRC.x * ${o[1]} + resTexRC.y;
      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec2(r, c);
    }
  `}function j5(r,t,e){return b.arraysEqual(r,t)?e?`
      ivec2 getOutputCoords() {
        return ivec2(resultUV.yx * vec2(outTexShape[0], outTexShape[1]));
      }
    `:`
      ivec2 getOutputCoords() {
        return ivec2(resultUV.yx * vec2(${t[0]}, ${t[1]}));
      }
    `:r[1]===1?e?`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(outTexShape[0], outTexShape[1]));
        int index = resTexRC.x * outTexShape[1] + resTexRC.y;
        return ivec2(index, 0);
      }
    `:`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(${t[0]}, ${t[1]}));
        int index = resTexRC.x * ${t[1]} + resTexRC.y;
        return ivec2(index, 0);
      }
    `:r[0]===1?e?`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(outTexShape[0], outTexShape[1]));
        int index = resTexRC.x * outTexShape[1] + resTexRC.y;
        return ivec2(0, index);
      }
    `:`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(${t[0]}, ${t[1]}));
        int index = resTexRC.x * ${t[1]} + resTexRC.y;
        return ivec2(0, index);
      }
    `:e?`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(outTexShape[0], outTexShape[1]));
      int index = resTexRC.x * outTexShape[1] + resTexRC.y;
      int r = index / outShape[1];
      int c = index - r * outShape[1];
      return ivec2(r, c);
    }
  `:`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      int r = index / ${r[1]};
      int c = index - r * ${r[1]};
      return ivec2(r, c);
    }
  `}function Ha(r){return`offset${r}`}function Y5(r){let t=r.name,e="get"+t.charAt(0).toUpperCase()+t.slice(1),o=ie();return`
    vec4 ${e}() {
      return ${o.texture2D}(${t}, halfCR);
    }
  `}function Z5(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1);if(r.shapeInfo.isUniform)return`float ${o}() {return ${e};}`;let[n,s]=r.shapeInfo.texShape;if(n===1&&s===1)return`
      float ${o}() {
        return sampleTexture(${e}, halfCR);
      }
    `;let a=Ha(e);if(t)return`
    float ${o}() {
      vec2 uv = uvFromFlat(${e}TexShape[0], ${e}TexShape[1], ${a});
      return sampleTexture(${e}, uv);
    }
  `;let[i,c]=r.shapeInfo.texShape;return`
    float ${o}() {
      vec2 uv = uvFromFlat(${i}, ${c}, ${a});
      return sampleTexture(${e}, uv);
    }
  `}function Q5(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=r.shapeInfo.texShape,s=ie();if(t)return`
    vec4 ${o}(int index) {
      ivec2 packedTexShape = ivec2(ceil(float(${e}TexShape[0]) / 2.0), ceil(float(${e}TexShape[1]) / 2.0));
      vec2 uv = packedUVfrom1D(
        packedTexShape[0], packedTexShape[1], index);
      return ${s.texture2D}(${e}, uv);
    }
  `;let a=[Math.ceil(n[0]/2),Math.ceil(n[1]/2)];return`
    vec4 ${o}(int index) {
      vec2 uv = packedUVfrom1D(
        ${a[0]}, ${a[1]}, index);
      return ${s.texture2D}(${e}, uv);
    }
  `}function J5(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1);if(r.shapeInfo.isUniform)return`
      float ${o}(int index) {
        ${Sl(r)}
      }
    `;let n=r.shapeInfo.texShape,s=n[0],a=n[1];if(a===1&&s===1)return`
      float ${o}(int index) {
        return sampleTexture(${e}, halfCR);
      }
    `;let i=Ha(e);return a===1?t?`
      float ${o}(int index) {
        vec2 uv = vec2(0.5, (float(index + ${i}) + 0.5) / float(${e}TexShape[0]));
        return sampleTexture(${e}, uv);
      }
    `:`
      float ${o}(int index) {
        vec2 uv = vec2(0.5, (float(index + ${i}) + 0.5) / ${s}.0);
        return sampleTexture(${e}, uv);
      }
    `:s===1?t?`
      float ${o}(int index) {
        vec2 uv = vec2((float(index + ${i}) + 0.5) / float(${e}TexShape[1]), 0.5);
        return sampleTexture(${e}, uv);
      }
    `:`
      float ${o}(int index) {
        vec2 uv = vec2((float(index + ${i}) + 0.5) / ${a}.0, 0.5);
        return sampleTexture(${e}, uv);
      }
    `:t?`
    float ${o}(int index) {
      vec2 uv = uvFromFlat(${e}TexShape[0], ${e}TexShape[1], index + ${i});
      return sampleTexture(${e}, uv);
    }
  `:`
    float ${o}(int index) {
      vec2 uv = uvFromFlat(${s}, ${a}, index + ${i});
      return sampleTexture(${e}, uv);
    }
  `}function t8(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape,a=s[0],i=s[1],c=ie();if(s!=null&&b.arraysEqual(e,s))return t?`
      vec4 ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);

        return ${c.texture2D}(${o}, uv);
      }
    `:`
      vec4 ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${i}.0, ${a}.0);

        return ${c.texture2D}(${o}, uv);
      }
    `;if(t)return`
    vec4 ${n}(int row, int col) {
      ivec2 packedTexShape = ivec2(ceil(float(${o}TexShape[0]) / 2.0), ceil(float(${o}TexShape[1]) / 2.0));
      int valuesPerRow = int(ceil(float(${o}Shape[1]) / 2.0));
      vec2 uv = packedUVfrom2D(valuesPerRow, packedTexShape[0], packedTexShape[1], row, col);
      return ${c.texture2D}(${o}, uv);
    }
  `;let l=[Math.ceil(s[0]/2),Math.ceil(s[1]/2)],u=Math.ceil(e[1]/2);return`
    vec4 ${n}(int row, int col) {
      vec2 uv = packedUVfrom2D(${u}, ${l[0]}, ${l[1]}, row, col);
      return ${c.texture2D}(${o}, uv);
    }
  `}function e8(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape;if(s!=null&&b.arraysEqual(e,s)){if(t)return`
      float ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `;let m=s[0],f=s[1];return`
    float ${n}(int row, int col) {
      vec2 uv = (vec2(col, row) + halfCR) / vec2(${f}.0, ${m}.0);
      return sampleTexture(${o}, uv);
    }
  `}let{newShape:a,keptDims:i}=b.squeezeShape(e),c=a;if(c.length<e.length){let m=Nl(r,c),f=["row","col"];return`
      ${Cl(m,t)}
      float ${n}(int row, int col) {
        return ${n}(${Tl(f,i)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col) {
        int index = round(dot(vec2(row, col), vec2(${e[1]}, 1)));
        ${Sl(r)}
      }
    `;let l=s[0],u=s[1],p=Ha(o);return u===1?t?`
      float ${n}(int row, int col) {
        float index = dot(vec3(row, col, ${p}), vec3(${o}Shape[1], 1, 1));
        vec2 uv = vec2(0.5, (index + 0.5) / float(${o}TexShape[0]));
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col) {
      float index = dot(vec3(row, col, ${p}), vec3(${e[1]}, 1, 1));
      vec2 uv = vec2(0.5, (index + 0.5) / ${l}.0);
      return sampleTexture(${o}, uv);
    }
  `:l===1?t?`
      float ${n}(int row, int col) {
        float index = dot(vec3(row, col, ${p}), vec3(${o}Shape[1], 1, 1));
        vec2 uv = vec2((index + 0.5) / float(${o}TexShape[1]), 0.5);
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col) {
      float index = dot(vec3(row, col, ${p}), vec3(${e[1]}, 1, 1));
      vec2 uv = vec2((index + 0.5) / ${u}.0, 0.5);
      return sampleTexture(${o}, uv);
    }
  `:t?`
      float ${n}(int row, int col) {
        // Explicitly use integer operations as dot() only works on floats.
        int index = row * ${o}Shape[1] + col + ${p};
        vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index);
        return sampleTexture(${o}, uv);
      }
    `:`
  float ${n}(int row, int col) {
    // Explicitly use integer operations as dot() only works on floats.
    int index = row * ${e[1]} + col + ${p};
    vec2 uv = uvFromFlat(${l}, ${u}, index);
    return sampleTexture(${o}, uv);
  }
`}function r8(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape,a=[Math.ceil(s[0]/2),Math.ceil(s[1]/2)];if(e[0]===1){let m=e.slice(1),f=[1,2],d=Nl(r,m),x=["b","row","col"];return`
        ${A2(d,t)}
        vec4 ${n}(int b, int row, int col) {
          return ${n}(${Tl(x,f)});
        }
      `}let i=ie();if(t)return`
    vec4 ${n}(int b, int row, int col) {
      ivec2 packedTexShape = ivec2(ceil(float(${o}TexShape[0]) / 2.0), ceil(float(${o}TexShape[1]) / 2.0));
      int valuesPerRow = int(ceil(float(${o}Shape[2]) / 2.0));
      int texelsInBatch = valuesPerRow * int(ceil(float(${o}Shape[1]) / 2.0));
      vec2 uv = packedUVfrom3D(
        packedTexShape[0], packedTexShape[1], texelsInBatch, valuesPerRow, b, row, col);
      return ${i.texture2D}(${o}, uv);
    }
  `;let c=a[0],l=a[1],u=Math.ceil(e[2]/2),p=u*Math.ceil(e[1]/2);return`
    vec4 ${n}(int b, int row, int col) {
      vec2 uv = packedUVfrom3D(
        ${c}, ${l}, ${p}, ${u}, b, row, col);
      return ${i.texture2D}(${o}, uv);
    }
  `}function o8(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=e[1]*e[2],a=e[2],{newShape:i,keptDims:c}=b.squeezeShape(e),l=i;if(l.length<e.length){let x=Nl(r,l),g=["row","col","depth"];return`
        ${Cl(x,t)}
        float ${n}(int row, int col, int depth) {
          return ${n}(${Tl(g,c)});
        }
      `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col, int depth) {
        int index = round(dot(vec3(row, col, depth),
                          vec3(${s}, ${a}, 1)));
        ${Sl(r)}
      }
    `;let u=r.shapeInfo.texShape,p=u[0],m=u[1],f=r.shapeInfo.flatOffset;if(m===s&&f==null)return t?`
      float ${n}(int row, int col, int depth) {
        int stride1 = ${o}Shape[2];
        float texR = float(row);
        float texC = dot(vec2(col, depth), vec2(stride1, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
        float ${n}(int row, int col, int depth) {
          float texR = float(row);
          float texC = dot(vec2(col, depth), vec2(${a}, 1));
          vec2 uv = (vec2(texC, texR) + halfCR) /
                     vec2(${m}.0, ${p}.0);
          return sampleTexture(${o}, uv);
        }
      `;if(m===a&&f==null)return t?`
      float ${n}(int row, int col, int depth) {
        float texR = dot(vec2(row, col), vec2(${o}Shape[1], 1));
        float texC = float(depth);
        vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col, int depth) {
      float texR = dot(vec2(row, col), vec2(${e[1]}, 1));
      float texC = float(depth);
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${m}.0, ${p}.0);
      return sampleTexture(${o}, uv);
    }
  `;let d=Ha(o);return t?`
    float ${n}(int row, int col, int depth) {
      // Explicitly use integer operations as dot() only works on floats.
      int stride0 = ${o}Shape[1] * ${o}Shape[2];
      int stride1 = ${o}Shape[2];
      int index = row * stride0 + col * stride1 + depth + ${d};
      vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index);
      return sampleTexture(${o}, uv);
    }
    `:`
      float ${n}(int row, int col, int depth) {
        // Explicitly use integer operations as dot() only works on floats.
        int index = row * ${s} + col * ${a} + depth + ${d};
        vec2 uv = uvFromFlat(${p}, ${m}, index);
        return sampleTexture(${o}, uv);
      }
  `}function n8(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=ie();if(t)return`
    vec4 ${o}(int b2, int b, int row, int col) {
      int valuesPerRow = int(ceil(float(${e}Shape[3]) / 2.0));
      int texelsInBatch = valuesPerRow * int(ceil(float(${e}Shape[2]) / 2.0));
      int index = b * texelsInBatch + (row / 2) * valuesPerRow + (col / 2);
      texelsInBatch *= ${e}Shape[1];
      index = b2 * texelsInBatch + index;
      ivec2 packedTexShape = ivec2(ceil(float(${e}TexShape[0]) / 2.0), ceil(float(${e}TexShape[1]) / 2.0));
      int texR = index / packedTexShape[1];
      int texC = index - texR * packedTexShape[1];
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(packedTexShape[1], packedTexShape[0]); return ${n.texture2D}(${e}, uv);
    }
  `;let s=r.shapeInfo.logicalShape,a=s.length,i=r.shapeInfo.texShape,c=[Math.ceil(i[0]/2),Math.ceil(i[1]/2)],l=c[0],u=c[1],p=Math.ceil(s[a-1]/2),m=p*Math.ceil(s[a-2]/2),f="int b, int row, int col",d=`b * ${m} + (row / 2) * ${p} + (col / 2)`;for(let x=2;x<a-1;x++)f=`int b${x}, `+f,m*=s[a-x-1],d=`b${x} * ${m} + `+d;return`
    vec4 ${o}(${f}) {
      int index = ${d};
      int texR = index / ${u};
      int texC = index - texR * ${u};
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${u}, ${l});
      return ${n.texture2D}(${e}, uv);
    }
  `}function s8(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=e[3],a=e[2]*s,i=e[1]*a,{newShape:c,keptDims:l}=b.squeezeShape(e);if(c.length<e.length){let v=Nl(r,c),N=["row","col","depth","depth2"];return`
      ${Cl(v,t)}
      float ${n}(int row, int col, int depth, int depth2) {
        return ${n}(${Tl(N,l)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col, int depth, int depth2) {
        int index = round(dot(vec4(row, col, depth, depth2),
                          vec4(${i}, ${a}, ${s}, 1)));
        ${Sl(r)}
      }
    `;let u=r.shapeInfo.flatOffset,p=r.shapeInfo.texShape,m=p[0],f=p[1],d=`int stride2 = ${o}Shape[3];`,x=`int stride1 = ${o}Shape[2] * stride2;`,g=`int stride0 = ${o}Shape[1] * stride1;`;if(f===i&&u==null)return t?`
      float ${n}(int row, int col, int depth, int depth2) {
        ${d}
        ${x}
        float texR = float(row);
        float texC =
            dot(vec3(col, depth, depth2),
                vec3(stride1, stride2, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = float(row);
        float texC =
            dot(vec3(col, depth, depth2),
                vec3(${a}, ${s}, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${f}.0, ${m}.0);
        return sampleTexture(${o}, uv);
      }
    `;if(f===s&&u==null)return t?`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = dot(vec3(row, col, depth),
                         vec3(${o}Shape[1] * ${o}Shape[2], ${o}Shape[2], 1));
        float texC = float(depth2);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = dot(vec3(row, col, depth),
                         vec3(${e[1]*e[2]}, ${e[2]}, 1));
        float texC = float(depth2);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${f}.0, ${m}.0);
        return sampleTexture(${o}, uv);
      }
    `;let y=Ha(o);return t?`
    float ${n}(int row, int col, int depth, int depth2) {
      // Explicitly use integer operations as dot() only works on floats.
      ${d}
      ${x}
      ${g}
      int index = row * stride0 + col * stride1 +
          depth * stride2 + depth2;
      vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index + ${y});
      return sampleTexture(${o}, uv);
    }
  `:`
    float ${n}(int row, int col, int depth, int depth2) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${i} + col * ${a} +
          depth * ${s} + depth2;
      vec2 uv = uvFromFlat(${m}, ${f}, index + ${y});
      return sampleTexture(${o}, uv);
    }
  `}function a8(r){let t=r.shapeInfo.logicalShape,e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=t[4],s=t[3]*n,a=t[2]*s,i=t[1]*a,{newShape:c,keptDims:l}=b.squeezeShape(t);if(c.length<t.length){let x=Nl(r,c),g=["row","col","depth","depth2","depth3"];return`
      ${Cl(x)}
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        return ${o}(${Tl(g,l)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        float index = dot(
          vec4(row, col, depth, depth2),
          vec4(${i}, ${a}, ${s}, ${n})) +
          depth3;
        ${Sl(r)}
      }
    `;let u=r.shapeInfo.flatOffset,p=r.shapeInfo.texShape,m=p[0],f=p[1];if(f===i&&u==null)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        int texR = row;
        float texC = dot(vec4(col, depth, depth2, depth3),
                         vec4(${a}, ${s}, ${n}, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${f}.0, ${m}.0);
        return sampleTexture(${e}, uv);
      }
    `;if(f===n&&u==null)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        float texR = dot(
          vec4(row, col, depth, depth2),
          vec4(${t[1]*t[2]*t[3]},
               ${t[2]*t[3]}, ${t[3]}, 1));
        int texC = depth3;
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${f}.0, ${m}.0);
        return sampleTexture(${e}, uv);
      }
    `;let d=Ha(e);return`
    float ${o}(int row, int col, int depth, int depth2, int depth3) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${i} + col * ${a} + depth * ${s} +
          depth2 * ${n} + depth3 + ${d};
      vec2 uv = uvFromFlat(${m}, ${f}, index);
      return sampleTexture(${e}, uv);
    }
  `}function i8(r){let t=r.shapeInfo.logicalShape,e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),{newShape:n,keptDims:s}=b.squeezeShape(t);if(n.length<t.length){let g=Nl(r,n),y=["row","col","depth","depth2","depth3","depth4"];return`
      ${Cl(g)}
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        return ${o}(${Tl(y,s)});
      }
    `}let a=t[5],i=t[4]*a,c=t[3]*i,l=t[2]*c,u=t[1]*l;if(r.shapeInfo.isUniform)return`
      float ${o}(int row, int col, int depth,
                  int depth2, int depth3, int depth4) {
        int index = round(dot(
          vec4(row, col, depth, depth2),
          vec4(${u}, ${l}, ${c}, ${i})) +
          dot(
            vec2(depth3, depth4),
            vec2(${a}, 1)));
        ${Sl(r)}
      }
    `;let p=r.shapeInfo.flatOffset,m=r.shapeInfo.texShape,f=m[0],d=m[1];if(d===u&&p==null)return`
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        int texR = row;
        float texC = dot(vec4(col, depth, depth2, depth3),
          vec4(${l}, ${c}, ${i}, ${a})) +
               float(depth4);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${d}.0, ${f}.0);
        return sampleTexture(${e}, uv);
      }
    `;if(d===a&&p==null)return`
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        float texR = dot(vec4(row, col, depth, depth2),
          vec4(${t[1]*t[2]*t[3]*t[4]},
               ${t[2]*t[3]*t[4]},
               ${t[3]*t[4]},
               ${t[4]})) + float(depth3);
        int texC = depth4;
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${d}.0, ${f}.0);
        return sampleTexture(${e}, uv);
      }
    `;let x=Ha(e);return`
    float ${o}(int row, int col, int depth,
                  int depth2, int depth3, int depth4) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${u} + col * ${l} + depth * ${c} +
          depth2 * ${i} + depth3 * ${a} + depth4 + ${x};
      vec2 uv = uvFromFlat(${f}, ${d}, index);
      return sampleTexture(${e}, uv);
    }
  `}function Sl(r){let t=r.name,e=b.sizeFromShape(r.shapeInfo.logicalShape);return e<2?`return ${t};`:`
    for (int i = 0; i < ${e}; i++) {
      if (i == index) {
        return ${t}[i];
      }
    }
  `}function c8(r,t){let e=r.name,o=e.charAt(0).toUpperCase()+e.slice(1),n="get"+o+"AtOutCoords",s=r.shapeInfo.logicalShape.length,a=t.logicalShape.length,i=$2(r.shapeInfo.logicalShape,t.logicalShape),c=St(a),l=a-s,u,p=["x","y","z","w","u","v"];s===0?u="":a<2&&i.length>=1?u="coords = 0;":u=i.map(v=>`coords.${p[v+l]} = 0;`).join(`
`);let m="";a<2&&s>0?m="coords":m=r.shapeInfo.logicalShape.map((v,N)=>`coords.${p[N+l]}`).join(", ");let f="return outputValue;",x=b.sizeFromShape(r.shapeInfo.logicalShape)===1,y=b.sizeFromShape(t.logicalShape)===1;if(s===1&&!x&&!y)f=`
      return vec4(outputValue.xy, outputValue.xy);
    `;else if(x&&!y)a===1?f=`
        return vec4(outputValue.x, outputValue.x, 0., 0.);
      `:f=`
        return vec4(outputValue.x);
      `;else if(i.length){let v=s-2,N=s-1;i.indexOf(v)>-1&&i.indexOf(N)>-1?f="return vec4(outputValue.x);":i.indexOf(v)>-1?f="return vec4(outputValue.x, outputValue.y, outputValue.x, outputValue.y);":i.indexOf(N)>-1&&(f="return vec4(outputValue.xx, outputValue.zz);")}return`
    vec4 ${n}() {
      ${c} coords = getOutputCoords();
      ${u}
      vec4 outputValue = get${o}(${m});
      ${f}
    }
  `}function l8(r,t){let e=r.name,o=e.charAt(0).toUpperCase()+e.slice(1),n="get"+o+"AtOutCoords",s=t.texShape,a=r.shapeInfo.texShape,i=r.shapeInfo.logicalShape.length,c=t.logicalShape.length;if(!r.shapeInfo.isUniform&&i===c&&r.shapeInfo.flatOffset==null&&b.arraysEqual(a,s))return`
      float ${n}() {
        return sampleTexture(${e}, resultUV);
      }
    `;let l=St(c),u=$2(r.shapeInfo.logicalShape,t.logicalShape),p=c-i,m,f=["x","y","z","w","u","v"];i===0?m="":c<2&&u.length>=1?m="coords = 0;":m=u.map(x=>`coords.${f[x+p]} = 0;`).join(`
`);let d="";return c<2&&i>0?d="coords":d=r.shapeInfo.logicalShape.map((x,g)=>`coords.${f[g+p]}`).join(", "),`
    float ${n}() {
      ${l} coords = getOutputCoords();
      ${m}
      return get${o}(${d});
    }
  `}function St(r){if(r<=1)return"int";if(r===2)return"ivec2";if(r===3)return"ivec3";if(r===4)return"ivec4";if(r===5)return"ivec5";if(r===6)return"ivec6";throw Error(`GPU for rank ${r} is not yet supported`)}function od(r,t,e){let{newShape:o,keptDims:n}=b.squeezeShape(t),s=t.length,a=r&&s===3&&t[0]===1,i=a?t.slice(1):o,c=!r&&s>1&&!b.arraysEqual(t,e)&&o.length<s||a;return{useSqueezeShape:c,uniformShape:c?i:t,keptDims:n}}function Nl(r,t){let e=JSON.parse(JSON.stringify(r));return e.shapeInfo.logicalShape=t,e}function Tl(r,t){return t.map(e=>r[e]).join(", ")}var $2,P5,L5,M5,B5,de=h(()=>{I();io();xn();({getBroadcastDims:$2}=k);P5=`
vec2 uvFromFlat(int texNumR, int texNumC, int index) {
  int texR = index / texNumC;
  int texC = index - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
vec2 packedUVfrom1D(int texNumR, int texNumC, int index) {
  int texelIndex = index / 2;
  int texR = texelIndex / texNumC;
  int texC = texelIndex - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,L5=`
vec2 packedUVfrom2D(int texelsInLogicalRow, int texNumR,
  int texNumC, int row, int col) {
  int texelIndex = (row / 2) * texelsInLogicalRow + (col / 2);
  int texR = texelIndex / texNumC;
  int texC = texelIndex - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,M5=`
vec2 packedUVfrom3D(int texNumR, int texNumC,
    int texelsInBatch, int texelsInLogicalRow, int b,
    int row, int col) {
  int index = b * texelsInBatch + (row / 2) * texelsInLogicalRow + (col / 2);
  int texR = index / texNumC;
  int texC = index - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,B5=`
  float getChannel(vec4 frag, vec2 innerDims) {
    vec2 modCoord = mod(innerDims, 2.);
    return modCoord.x == 0. ?
      (modCoord.y == 0. ? frag.r : frag.g) :
      (modCoord.y == 0. ? frag.b : frag.a);
  }
  float getChannel(vec4 frag, int dim) {
    float modCoord = mod(float(dim), 2.);
    return modCoord == 0. ? frag.r : frag.g;
  }
`});function F2(r,t,e,o){let n=e.map((u,p)=>{let m={logicalShape:u.shape,texShape:u.isUniform?null:u.texData.texShape,isUniform:u.isUniform,isPacked:u.isUniform?!1:u.texData.isPacked,flatOffset:null};return u.texData!=null&&u.texData.slice!=null&&u.texData.slice.flatOffset>0&&(m.flatOffset=u.texData.slice.flatOffset),{name:t.variableNames[p],shapeInfo:m}}),s=n.map(u=>u.shapeInfo),a={logicalShape:o.shape,texShape:o.texData.texShape,isUniform:!1,isPacked:o.texData.isPacked,flatOffset:null},i=R2(n,a,t),c=l2(r.gl,i),l=r.createProgram(c);return O().get("ENGINE_COMPILE_ONLY")?{program:t,fragmentShader:c,source:i,webGLProgram:l,inShapeInfos:s,outShapeInfo:a,variablesLocations:null,customUniformLocations:null,infLoc:null,nanLoc:null,outShapeLocation:null,outShapeStridesLocation:null,outTexShapeLocation:null}:(r.buildVao(l),Object.assign({program:t,fragmentShader:c,source:i,webGLProgram:l,inShapeInfos:s,outShapeInfo:a},cb(r,t,l)))}function cb(r,t,e){let o=[],n=[],s,a,i,c=null,l=null;l=r.getUniformLocation(e,"NAN",!1),O().getNumber("WEBGL_VERSION")===1&&(c=r.getUniformLocation(e,"INFINITY",!1));let u=!1;for(let p of t.variableNames){let m={name:p,uniform:r.getUniformLocation(e,p,u),offset:r.getUniformLocation(e,`offset${p}`,u)};t.enableShapeUniforms&&(m.shape=r.getUniformLocation(e,`${p}Shape`,u),m.texShape=r.getUniformLocation(e,`${p}TexShape`,u)),o.push(m)}if(t.enableShapeUniforms&&(s=r.getUniformLocation(e,"outShape",u),i=r.getUniformLocation(e,"outShapeStrides",u),a=r.getUniformLocation(e,"outTexShape",u)),t.customUniforms)for(let p of t.customUniforms)n.push(r.getUniformLocation(e,p.name,u));return{variablesLocations:o,customUniformLocations:n,infLoc:c,nanLoc:l,outShapeLocation:s,outShapeStridesLocation:i,outTexShapeLocation:a}}function D2(r,t){if(r.length!==t.length)throw Error(`Binary was compiled with ${r.length} inputs, but was executed with ${t.length} inputs`);r.forEach((e,o)=>{let n=e.logicalShape,s=t[o],a=s.shape;if(!b.arraysEqual(n,a))throw Error(`Binary was compiled with different shapes than the current args. Shapes ${n} and ${a} must match`);if(e.isUniform&&s.isUniform)return;let i=e.texShape,c=s.isUniform?null:s.texData.texShape;if(!b.arraysEqual(i,c))throw Error(`Binary was compiled with different texture shapes than the current args. Shape ${i} and ${c} must match`)})}function O2(r,t,e,o,n){t.program.enableShapeUniforms||(D2(t.inShapeInfos,e),D2([t.outShapeInfo],[o]));let s=o.texData.texture,a=o.texData.texShape;o.texData.isPacked?r.setOutputPackedMatrixTexture(s.texture,a[0],a[1]):r.setOutputMatrixTexture(s.texture,a[0],a[1]),r.setProgram(t.webGLProgram),r.bindVertexArray(t.webGLProgram.vao),O().getNumber("WEBGL_VERSION")===1&&t.infLoc!==null&&r.gl.uniform1f(t.infLoc,1/0),t.nanLoc!==null&&r.gl.uniform1f(t.nanLoc,NaN);for(let c=0;c<e.length;++c){let l=e[c],{uniform:u,offset:p,shape:m,texShape:f}=t.variablesLocations[c];if(m){let{uniformShape:d}=od(t.program.packedInputs,l.shape,l.texData.texShape);switch(d.length){case 1:r.gl.uniform1iv(m,new Int32Array(d));break;case 2:r.gl.uniform2iv(m,new Int32Array(d));break;case 3:r.gl.uniform3iv(m,new Int32Array(d));break;case 4:r.gl.uniform4iv(m,new Int32Array(d));break;default:break}}if(f&&r.gl.uniform2i(f,l.texData.texShape[0],l.texData.texShape[1]),u!=null){if(l.isUniform){if(b.sizeFromShape(l.shape)<2)r.gl.uniform1f(u,l.uniformValues[0]);else{let d=l.uniformValues;d instanceof Float32Array||(d=new Float32Array(d)),r.gl.uniform1fv(u,d)}continue}l.texData.slice!=null&&p!=null&&r.gl.uniform1i(p,l.texData.slice.flatOffset),r.setInputMatrixTexture(l.texData.texture.texture,u,c)}}let i=t.outShapeLocation;if(i)switch(o.shape.length){case 1:r.gl.uniform1iv(i,new Int32Array(o.shape));break;case 2:r.gl.uniform2iv(i,new Int32Array(o.shape));break;case 3:r.gl.uniform3iv(i,new Int32Array(o.shape));break;case 4:r.gl.uniform4iv(i,new Int32Array(o.shape));break;default:break}if(t.outShapeStridesLocation){let c=b.computeStrides(o.shape);switch(o.shape.length){case 2:r.gl.uniform1iv(t.outShapeStridesLocation,new Int32Array(c));break;case 3:r.gl.uniform2iv(t.outShapeStridesLocation,new Int32Array(c));break;case 4:r.gl.uniform3iv(t.outShapeStridesLocation,new Int32Array(c));break;default:break}}if(t.outTexShapeLocation&&r.gl.uniform2i(t.outTexShapeLocation,o.texData.texShape[0],o.texData.texShape[1]),t.program.customUniforms&&n)for(let c=0;c<t.program.customUniforms.length;++c){let l=t.program.customUniforms[c],u=t.customUniformLocations[c],p=n[c];if(l.type==="float")r.gl.uniform1fv(u,p);else if(l.type==="vec2")r.gl.uniform2fv(u,p);else if(l.type==="vec3")r.gl.uniform3fv(u,p);else if(l.type==="vec4")r.gl.uniform4fv(u,p);else if(l.type==="int")r.gl.uniform1iv(u,p);else if(l.type==="ivec2")r.gl.uniform2iv(u,p);else if(l.type==="ivec3")r.gl.uniform3iv(u,p);else if(l.type==="ivec4")r.gl.uniform4iv(u,p);else throw Error(`uniform type ${l.type} is not supported yet.`)}r.executeProgram()}function P2(r,t,e){let o="";t.concat(e).forEach(a=>{let i=a.texData!=null&&a.texData.slice!=null&&a.texData.slice.flatOffset>0;if(r.enableShapeUniforms&&!a.isUniform){let c=a.texData.texShape,{useSqueezeShape:l,uniformShape:u,keptDims:p}=od(r.packedInputs,a.shape,c),m="",f="",d="";if(u.length===1&&r.packedInputs){let R=[Math.ceil(c[0]/2),Math.ceil(c[1]/2)];m=`${R[0]>1}_${R[1]>1}`}else if(u.length===2&&!r.packedInputs)f=`${u[0]>1}_${u[1]>1}`;else if(u.length>2&&!r.packedInputs){let R=b.computeStrides(u);d=`${R[0]===c[1]}_${R[R.length-1]===c[1]}`}let x=a.shape.length,g=u.length===2&&b.arraysEqual(a.shape,c),y=b.sizeFromShape(a.shape)===1,v=k.getBroadcastDims(a.shape,e.shape),N=!r.packedInputs&&x===e.shape.length&&b.arraysEqual(c,e.texData.texShape),S=r.packedInputs||u.length>2?"":`${c[0]>1}_${c[1]>1}`;o+=`${x}_${N}_${l?p:""}_${u.length}_${y}_${v}_${g}_${m}_${f}_${d}_${S}_${i}`}else{let c=a.isUniform?"uniform":a.texData.texShape;o+=`${a.shape}_${c}_${i}`}});let n=r.userCode,s=r.constructor.name;return s+="_"+o+"_"+n+`${O().getNumber("WEBGL_VERSION")}`,s}function qt(r){return O().getBool("WEBGL_USE_SHAPES_UNIFORMS")&&r<=4}var Oe=h(()=>{I();de();Fr();});var nd,L2=h(()=>{io();Oe();xn();ao();nd=class{constructor(t){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.outPackingScheme=Zn.DENSE,this.customUniforms=[{name:"texShape",type:"ivec2"}];let e=ie();this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length),this.userCode=`
      ivec3 outCoordsFromFlatIndex(int index) {
        ${this.enableShapeUniforms?Ua(["r","c","d"],t):wo(["r","c","d"],t)}
        return ivec3(r, c, d);
      }

      void main() {
        ivec2 resTexRC = ivec2(resultUV.yx * vec2(texShape[0], texShape[1]));
        int index = 4 * (resTexRC.x * texShape[1] + resTexRC.y);

        vec4 result = vec4(0.);

        for (int i=0; i<4; i++) {
          int flatIndex = index + i;
          ivec3 rc = outCoordsFromFlatIndex(flatIndex);
          result[i] = getA(rc.x, rc.y, rc.z);
        }

        ${e.output} = result;
      }
    `}}});var sd,M2=h(()=>{io();Oe();xn();ao();sd=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outPackingScheme=Zn.DENSE,this.customUniforms=[{name:"texShape",type:"ivec2"}];let e=ie();this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length),this.userCode=`
      ivec3 outCoordsFromFlatIndex(int index) {
        ${this.enableShapeUniforms?Ua(["r","c","d"],t):wo(["r","c","d"],t)}
        return ivec3(r, c, d);
      }

      void main() {
        ivec2 resTexRC = ivec2(resultUV.yx * vec2(texShape[0], texShape[1]));
        int index = 4 * (resTexRC.x * texShape[1] + resTexRC.y);

        vec4 result = vec4(0.);

        for (int i=0; i<4; i++) {
          int flatIndex = index + i;
          ivec3 rc = outCoordsFromFlatIndex(flatIndex);
          result[i] = getChannel(getA(rc.x, rc.y, rc.z), vec2(rc.y, rc.z));
        }

        ${e.output} = result;
      }
    `}}});var ad,B2=h(()=>{io();xn();ao();ad=class{constructor(t){this.variableNames=["A"],this.outTexUsage=Ze.DOWNLOAD;let e=ie();this.outputShape=t,this.userCode=`
      ${rd}

      void main() {
        float x = getAAtOutCoords();
        ${e.output} = encode_float(x);
      }
    `}}});var id,V2=h(()=>{io();xn();ao();id=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!1,this.outTexUsage=Ze.DOWNLOAD;let e=ie();this.outputShape=t,this.userCode=`
      ${rd}

      void main() {
        ivec3 coords = getOutputCoords();
        float x = getChannel(getAAtOutCoords(), vec2(coords.y, coords.z));
        ${e.output} = encode_float(x);
      }
    `}}});var m8,np,z2=h(()=>{io();Oe();xn();m8={R:0,G:1,B:2,A:3},np=class{constructor(t,e=!1,o="RGBA"){this.variableNames=["A"],this.customUniforms=[{name:"texShape",type:"ivec2"}];let n=ie();this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length);let s="result";e&&(s="floor(result * 255. + 0.5)");let a="";for(let i=0;i<o.length;i++){let c=o[i];a+=`
          if(offset == ${i}) {
            result = values[${m8[c]}];
          }`}this.userCode=`
      ${this.enableShapeUniforms?vl():bl(t)}

      void main() {
        ivec3 coords = getOutputCoords();
        int flatIndex = getFlatIndex(coords);
        float result = 0.;
        int offset = imod(flatIndex, ${o.length});

        flatIndex = idiv(flatIndex, ${o.length}, 1.);

        int r = flatIndex / texShape[1];
        if (r < texShape[0]) {
          int c = imod(flatIndex, texShape[1]);
          vec2 uv = (vec2(c, r) + halfCR) / vec2(texShape[1], texShape[0]);
          vec4 values = ${n.texture2D}(A, uv);
          ${a}
        }
        ${n.output} = vec4(${s}, 0., 0., 0.);
      }
    `}}});var cd,G2=h(()=>{io();Oe();xn();cd=class{constructor(t,e=!1){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.customUniforms=[{name:"texShape",type:"ivec2"}];let o=ie();this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length);let n="",s="result";e&&(s="floor(result * 255. + 0.5)");for(let a=0;a<=1;a++)for(let i=0;i<=1;i++){let c=a*2+i;n+=`
          localCoords = coords;
          if(localCoords[2] + ${i} < ${this.enableShapeUniforms?"outShape[2]":`${t[2]}`}) {
          localCoords[2] += ${i};
          if (localCoords[1] + ${a} < ${this.enableShapeUniforms?"outShape[1]":`${t[1]}`}) {
            localCoords[1] += ${a};

            flatIndex = getFlatIndex(localCoords);
            offset = imod(flatIndex, 4);

            flatIndex = idiv(flatIndex, 4, 1.);

            int r = flatIndex / texShape[1];
            int c = imod(flatIndex, texShape[1]);
            vec2 uv = (vec2(c, r) + halfCR) / vec2(texShape[1], texShape[0]);
            values = ${o.texture2D}(A, uv);

            if (offset == 0) {
              result[${c}] = values[0];
            } else if (offset == 1) {
              result[${c}] = values[1];
            } else if (offset == 2) {
              result[${c}] = values[2];
            } else {
              result[${c}] = values[3];
            }
          }
        }
        `}this.userCode=`
        ${this.enableShapeUniforms?vl():bl(t)}

        void main() {
          ivec3 coords = getOutputCoords();

          vec4 result = vec4(0.);
          int flatIndex, r, c, offset;
          ivec3 localCoords;
          vec2 uv;
          vec4 values;

          ${n}

          ${o.output} = ${s};
        }
    `}}});function W2(r){let t=ie(),e=`${t.version}
    precision highp float;
    ${t.attribute} vec3 clipSpacePos;
    ${t.attribute} vec2 uv;
    ${t.varyingVs} vec2 resultUV;

    void main() {
      gl_Position = vec4(clipSpacePos, 1);
      resultUV = uv;
    }`;return c2(r,e)}function U2(r){let t=new Float32Array([-1,1,0,0,1,-1,-1,0,0,0,1,1,0,1,1,1,-1,0,1,0]);return m2(r,t)}function H2(r){let t=new Uint16Array([0,1,2,2,1,3]);return f2(r,t)}function sp(r,t,e,o,n,s){h2(t,e);let a=d2(r),i=r.TEXTURE_2D;return ct(r,()=>r.bindTexture(i,a)),ct(r,()=>r.texParameteri(i,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE)),ct(r,()=>r.texParameteri(i,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE)),ct(r,()=>r.texParameteri(i,r.TEXTURE_MIN_FILTER,r.NEAREST)),ct(r,()=>r.texParameteri(i,r.TEXTURE_MAG_FILTER,r.NEAREST)),O().getNumber("WEBGL_VERSION")===1?ct(r,()=>r.texImage2D(i,0,o,t,e,0,n,s,null)):ct(r,()=>r.texStorage2D(i,1,o,t,e)),ct(r,()=>r.bindTexture(r.TEXTURE_2D,null)),{texture:a,texShape:[e,t]}}function lb(r){return r.internalFormatFloat}function K2(r,t,e,o){let[n,s]=Ga(t,e);return sp(r,n,s,lb(o),o.textureFormatFloat,r.FLOAT)}function ub(r){return r.internalFormatHalfFloat}function q2(r,t,e,o){let[n,s]=Ga(t,e);return sp(r,n,s,ub(o),o.textureFormatFloat,o.textureTypeHalfFloat)}function pb(r){return r.downloadTextureFormat}function X2(r,t,e,o){let[n,s]=Ga(t,e);return sp(r,n,s,pb(o),r.RGBA,r.UNSIGNED_BYTE)}function mb(r){return r.internalFormatPackedFloat}function j2(r,t,e,o){let[n,s]=Ho(t,e);return sp(r,n,s,mb(o),r.RGBA,r.FLOAT)}function fb(r){return r.internalFormatPackedHalfFloat}function Y2(r,t,e,o){let[n,s]=Ho(t,e);return sp(r,n,s,fb(o),r.RGBA,o.textureTypeHalfFloat)}function Z2(r,t,e){return ct(r,()=>r.bindBuffer(r.ARRAY_BUFFER,e)),sb(r,t,"clipSpacePos",e,3,20,0)&&sb(r,t,"uv",e,2,20,12)}function Q2(r,t,e,o,n,s){ct(r,()=>r.bindTexture(r.TEXTURE_2D,t));let a,i,c;n instanceof Uint8Array?(a=new Uint8Array(e*o*4),i=r.UNSIGNED_BYTE,c=r.RGBA):(a=new Float32Array(e*o*4),i=r.FLOAT,c=s.internalFormatPackedFloat),a.set(n),O().getNumber("WEBGL_VERSION")===2?ct(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,e,o,r.RGBA,i,a)):ct(r,()=>r.texImage2D(r.TEXTURE_2D,0,c,e,o,0,r.RGBA,i,a)),ct(r,()=>r.bindTexture(r.TEXTURE_2D,null))}function J2(r,t,e){ct(r,()=>r.bindTexture(r.TEXTURE_2D,t)),e.data instanceof Uint8Array?O().getNumber("WEBGL_VERSION")===2?ct(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,e.width,e.height,r.RGBA,r.UNSIGNED_BYTE,e.data)):ct(r,()=>r.texImage2D(r.TEXTURE_2D,0,r.RGBA,e.width,e.height,0,r.RGBA,r.UNSIGNED_BYTE,e.data)):O().getNumber("WEBGL_VERSION")===2?ct(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,r.RGBA,r.UNSIGNED_BYTE,e)):ct(r,()=>r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,e)),ct(r,()=>r.bindTexture(r.TEXTURE_2D,null))}function t$(r,t,e,o){let n=r.createBuffer();ct(r,()=>r.bindBuffer(r.PIXEL_PACK_BUFFER,n));let i=4*4*t*e;return ct(r,()=>r.bufferData(r.PIXEL_PACK_BUFFER,i,r.STREAM_READ)),ct(r,()=>r.readPixels(0,0,e,t,r.RGBA,r.FLOAT,0)),ct(r,()=>r.bindBuffer(r.PIXEL_PACK_BUFFER,null)),n}function e$(r,t,e){let o=r,n=new Float32Array(e);return o.bindBuffer(o.PIXEL_PACK_BUFFER,t),o.getBufferSubData(o.PIXEL_PACK_BUFFER,0,n),o.bindBuffer(o.PIXEL_PACK_BUFFER,null),n}function r$(r,t,e,o){let[n,s]=Ga(t,e),a=4,i=new Uint8Array(s2(t*e,a));return ct(r,()=>r.readPixels(0,0,n,s,o.downloadTextureFormat,r.UNSIGNED_BYTE,i)),new Float32Array(i.buffer)}function o$(r,t,e,o,n,s,a,i){let c=r,l=new Float32Array(a2(s,a));return c.bindBuffer(c.PIXEL_PACK_BUFFER,t),c.getBufferSubData(c.PIXEL_PACK_BUFFER,0,l),c.bindBuffer(c.PIXEL_PACK_BUFFER,null),l}function n$(r,t,e){let o=new Float32Array(t*e*4);return ct(r,()=>r.readPixels(0,0,e,t,r.RGBA,r.FLOAT,o)),o}var db=h(()=>{I();io();ao();Fr();});function d8(r){let t=0;for(;t<r.length&&r[t]();++t);return t-1}var Il,s$=h(()=>{I();Zf();db();ao();Fr();Il=class{constructor(t){this.outputTexture=null,this.program=null,this.disposed=!1,this.itemsToPoll=[];let e=O().getNumber("WEBGL_VERSION");if(t!=null?(this.gl=t,n2(e,t)):this.gl=Dr(e),t=this.gl,O().getNumber("WEBGL_VERSION")===2){let s=t;this.createVertexArray=()=>ct(s,()=>s.createVertexArray()),this.bindVertexArray=a=>ct(s,()=>s.bindVertexArray(a)),this.deleteVertexArray=a=>ct(s,()=>s.deleteVertexArray(a)),this.getVertexArray=()=>ct(s,()=>s.getParameter(s.VERTEX_ARRAY_BINDING))}else if(t!=null){let s=t.getExtension("OES_vertex_array_object");if(s==null)throw new Error("All WebGL1 implementations are expected to offer OES_vertex_array_object.");this.createVertexArray=()=>ct(t,()=>s.createVertexArrayOES()),this.bindVertexArray=a=>ct(t,()=>s.bindVertexArrayOES(a)),this.deleteVertexArray=a=>ct(t,()=>s.deleteVertexArrayOES(a)),this.getVertexArray=()=>ct(t,()=>t.getParameter(s.VERTEX_ARRAY_BINDING_OES))}let o="WEBGL_color_buffer_float",n="EXT_color_buffer_half_float";if(this.parallelCompilationExtension=this.gl.getExtension("KHR_parallel_shader_compile"),O().getNumber("WEBGL_VERSION")===1){let s="OES_texture_float",a="OES_texture_half_float";if(this.textureFloatExtension=ep(this.gl,s),Zr(this.gl,a))this.textureHalfFloatExtension=ep(this.gl,a);else if(O().get("WEBGL_FORCE_F16_TEXTURES"))throw new Error("GL context does not support half float textures, yet the environment flag WEBGL_FORCE_F16_TEXTURES is set to true.");if(this.colorBufferFloatExtension=this.gl.getExtension(o),Zr(this.gl,n))this.colorBufferHalfFloatExtension=ep(this.gl,n);else if(O().get("WEBGL_FORCE_F16_TEXTURES"))throw new Error("GL context does not support color renderable half floats, yet the environment flag WEBGL_FORCE_F16_TEXTURES is set to true.")}else if(o="EXT_color_buffer_float",Zr(this.gl,o))this.colorBufferFloatExtension=this.gl.getExtension(o);else if(Zr(this.gl,n))this.colorBufferHalfFloatExtension=this.gl.getExtension(n);else throw new Error("GL context does not support color renderable floats");this.vertexBuffer=U2(this.gl),this.indexBuffer=H2(this.gl),this.framebuffer=g2(this.gl),this.textureConfig=tp(this.gl,this.textureHalfFloatExtension)}get debug(){return O().getBool("DEBUG")}dispose(){if(this.disposed)return;this.program!=null&&console.warn("Disposing a GPGPUContext that still has a bound WebGLProgram. This is probably a resource leak, delete the program with GPGPUContext.deleteProgram before disposing."),this.outputTexture!=null&&console.warn("Disposing a GPGPUContext that still has a bound output matrix texture.  This is probably a resource leak, delete the output matrix texture with GPGPUContext.deleteMatrixTexture before disposing.");let t=this.gl;ct(t,()=>t.finish()),ct(t,()=>t.bindFramebuffer(t.FRAMEBUFFER,null)),ct(t,()=>t.deleteFramebuffer(this.framebuffer)),ct(t,()=>t.bindBuffer(t.ARRAY_BUFFER,null)),ct(t,()=>t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,null)),ct(t,()=>t.deleteBuffer(this.indexBuffer)),this.disposed=!0}createFloat32MatrixTexture(t,e){return this.throwIfDisposed(),K2(this.gl,t,e,this.textureConfig)}createFloat16MatrixTexture(t,e){return this.throwIfDisposed(),q2(this.gl,t,e,this.textureConfig)}createUnsignedBytesMatrixTexture(t,e){return this.throwIfDisposed(),X2(this.gl,t,e,this.textureConfig)}uploadPixelDataToTexture(t,e){this.throwIfDisposed(),J2(this.gl,t,e)}uploadDenseMatrixToTexture(t,e,o,n){this.throwIfDisposed(),Q2(this.gl,t,e,o,n,this.textureConfig)}createFloat16PackedMatrixTexture(t,e){return this.throwIfDisposed(),Y2(this.gl,t,e,this.textureConfig)}createPackedMatrixTexture(t,e){return this.throwIfDisposed(),j2(this.gl,t,e,this.textureConfig)}deleteMatrixTexture(t){this.throwIfDisposed(),this.outputTexture===t&&(ab(this.gl,this.framebuffer),this.outputTexture=null),ct(this.gl,()=>this.gl.deleteTexture(t))}downloadByteEncodedFloatMatrixFromOutputTexture(t,e,o){return this.downloadMatrixDriver(t,()=>r$(this.gl,e,o,this.textureConfig))}downloadPackedMatrixFromBuffer(t,e,o,n,s,a){return o$(this.gl,t,e,o,n,s,a,this.textureConfig)}downloadFloat32MatrixFromBuffer(t,e){return e$(this.gl,t,e)}createBufferFromTexture(t,e,o){this.bindTextureToFrameBuffer(t);let n=t$(this.gl,e,o,this.textureConfig);return this.unbindTextureToFrameBuffer(),n}createAndWaitForFence(){let t=this.createFence(this.gl);return this.pollFence(t)}createFence(t){let e,o;if(O().getBool("WEBGL_FENCE_API_ENABLED")){let n=t,s=n.fenceSync(n.SYNC_GPU_COMMANDS_COMPLETE,0);t.flush(),o=()=>{let a=n.clientWaitSync(s,0,0);return a===n.ALREADY_SIGNALED||a===n.CONDITION_SATISFIED},e=s}else O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")>0?(e=this.beginQuery(),this.endQuery(),o=()=>this.isQueryAvailable(e,O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))):o=()=>!0;return{query:e,isFencePassed:o}}downloadMatrixFromPackedTexture(t,e,o){return this.downloadMatrixDriver(t,()=>n$(this.gl,e,o))}createProgram(t){this.throwIfDisposed();let e=this.gl;this.vertexShader==null&&(this.vertexShader=W2(e));let o=u2(e);ct(e,()=>e.attachShader(o,this.vertexShader)),ct(e,()=>e.attachShader(o,t)),p2(e,o);let n=Object.assign(o,{vao:this.createVertexArray()});return this.debug&&Jf(e,n),n}buildVao(t){this.setProgram(t),this.bindVertexArray(t.vao);let e=this.gl;ct(e,()=>e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,this.indexBuffer)),Z2(e,t,this.vertexBuffer)}deleteProgram(t){this.throwIfDisposed(),t===this.program&&(this.program=null),t!=null&&(ct(this.gl,()=>this.gl.deleteProgram(t)),this.deleteVertexArray(t.vao))}setProgram(t){this.throwIfDisposed(),this.program=t,this.program!=null&&this.debug&&Jf(this.gl,this.program),ct(this.gl,()=>this.gl.useProgram(t))}getUniformLocation(t,e,o=!0){return this.throwIfDisposed(),o?x2(this.gl,t,e):y2(this.gl,t,e)}getAttributeLocation(t,e){return this.throwIfDisposed(),ct(this.gl,()=>this.gl.getAttribLocation(t,e))}getUniformLocationNoThrow(t,e){return this.throwIfDisposed(),this.gl.getUniformLocation(t,e)}setInputMatrixTexture(t,e,o){this.throwIfDisposed(),this.throwIfNoProgram(),b2(this.gl,t,e,o)}setOutputMatrixTexture(t,e,o){this.setOutputMatrixTextureDriver(t,o,e)}setOutputPackedMatrixTexture(t,e,o){this.throwIfDisposed();let[n,s]=Ho(e,o);this.setOutputMatrixTextureDriver(t,n,s)}setOutputMatrixWriteRegion(t,e,o,n){this.setOutputMatrixWriteRegionDriver(o,t,n,e)}setOutputPackedMatrixWriteRegion(t,e,o,n){throw new Error("setOutputPackedMatrixWriteRegion not implemented.")}debugValidate(){this.program!=null&&Jf(this.gl,this.program),rp(this.gl)}executeProgram(){this.throwIfDisposed(),this.throwIfNoProgram();let t=this.gl;if(this.debug){let e=this.getVertexArray();console.assert(e===this.program.vao,"VAO changed between setProgram and executeProgram!"),this.debugValidate()}ct(t,()=>t.drawElements(t.TRIANGLES,6,t.UNSIGNED_SHORT,0))}blockUntilAllProgramsCompleted(){this.throwIfDisposed(),ct(this.gl,()=>this.gl.finish())}getQueryTimerExtension(){return this.disjointQueryTimerExtension==null&&(this.disjointQueryTimerExtension=ep(this.gl,O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2?"EXT_disjoint_timer_query_webgl2":"EXT_disjoint_timer_query")),this.disjointQueryTimerExtension}getQueryTimerExtensionWebGL2(){return this.getQueryTimerExtension()}getQueryTimerExtensionWebGL1(){return this.getQueryTimerExtension()}beginQuery(){if(O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2){let o=this.gl,n=this.getQueryTimerExtensionWebGL2(),s=o.createQuery();return o.beginQuery(n.TIME_ELAPSED_EXT,s),s}let t=this.getQueryTimerExtensionWebGL1(),e=t.createQueryEXT();return t.beginQueryEXT(t.TIME_ELAPSED_EXT,e),e}endQuery(){if(O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2){let e=this.gl,o=this.getQueryTimerExtensionWebGL2();e.endQuery(o.TIME_ELAPSED_EXT);return}let t=this.getQueryTimerExtensionWebGL1();t.endQueryEXT(t.TIME_ELAPSED_EXT)}async waitForQueryAndGetTime(t){return await b.repeatedTry(()=>this.disposed||this.isQueryAvailable(t,O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))),this.getQueryTime(t,O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))}getQueryTime(t,e){if(e===0)return null;if(e===2){let o=this.gl;return o.getQueryParameter(t,o.QUERY_RESULT)/1e6}else{let o=this.getQueryTimerExtensionWebGL1();return o.getQueryObjectEXT(t,o.QUERY_RESULT_EXT)/1e6}}isQueryAvailable(t,e){if(e===0)return!0;if(e===2){let o=this.gl,n=this.getQueryTimerExtensionWebGL2(),s=o.getQueryParameter(t,o.QUERY_RESULT_AVAILABLE);return this.disjoint==null&&(this.disjoint=this.gl.getParameter(n.GPU_DISJOINT_EXT)),s&&!this.disjoint}else{let o=this.getQueryTimerExtensionWebGL1(),n=o.getQueryObjectEXT(t,o.QUERY_RESULT_AVAILABLE_EXT);return this.disjoint==null&&(this.disjoint=this.gl.getParameter(o.GPU_DISJOINT_EXT)),n&&!this.disjoint}}pollFence(t){return new Promise(e=>{this.addItemToPoll(()=>t.isFencePassed(),()=>e())})}pollItems(){let t=d8(this.itemsToPoll.map(e=>e.isDoneFn));for(let e=0;e<=t;++e){let{resolveFn:o}=this.itemsToPoll[e];o()}this.itemsToPoll=this.itemsToPoll.slice(t+1)}addItemToPoll(t,e){if(this.itemsToPoll.push({isDoneFn:t,resolveFn:e}),this.itemsToPoll.length>1)return;let o;"setTimeoutCustom"in O().platform&&(o=O().platform.setTimeoutCustom.bind(O().platform)),b.repeatedTry(()=>(this.pollItems(),this.itemsToPoll.length===0),()=>0,null,o)}bindTextureToFrameBuffer(t){this.throwIfDisposed(),td(this.gl,t,this.framebuffer),this.debug&&rp(this.gl)}unbindTextureToFrameBuffer(){this.outputTexture!=null?(td(this.gl,this.outputTexture,this.framebuffer),this.debug&&rp(this.gl)):ab(this.gl,this.framebuffer)}downloadMatrixDriver(t,e){this.bindTextureToFrameBuffer(t);let o=e();return this.unbindTextureToFrameBuffer(),o}setOutputMatrixTextureDriver(t,e,o){this.throwIfDisposed();let n=this.gl;td(n,t,this.framebuffer),this.debug&&rp(n),this.outputTexture=t,ct(n,()=>n.viewport(0,0,e,o)),ct(n,()=>n.scissor(0,0,e,o))}setOutputMatrixWriteRegionDriver(t,e,o,n){this.throwIfDisposed(),ct(this.gl,()=>this.gl.scissor(t,e,o,n))}throwIfDisposed(){if(this.disposed)throw new Error("Attempted to use disposed GPGPUContext.")}throwIfNoProgram(){if(this.program==null)throw new Error("No GPU program is currently set.")}}});function Y(r,t){Array.isArray(r)||(r=[r]),r.forEach(e=>{e!=null&&b.assert(e.dtype!=="complex64",()=>`${t} does not support complex64 tensors in the CPU backend.`)})}var ft=h(()=>{I();});function hb(r){let t=new Float32Array(r.length);for(let e=0;e<r.length;++e)t[e]=Math.abs(r[e]);return t}var h8,a$,gb=h(()=>{I();ft();h8=r=>{let{x:t}=r.inputs,e=r.backend;Y(t,"abs");let o=new Float32Array(b.sizeFromShape(t.shape)),n=e.data.get(t.dataId).values;return o=hb(n),e.makeOutput(o,t.shape,t.dtype)},a$={kernelName:"Abs",backendName:"cpu",kernelFunc:h8}});function Rt(r){return(t,e,o,n,s)=>{let a=k.assertAndGetBroadcastShape(t,e),i=a.length,c=b.computeStrides(a),l=b.sizeFromShape(a),u=b.getTypedArrayFromDType(s,l),p=t.length,m=e.length,f=b.computeStrides(t),d=b.computeStrides(e),x=k.getBroadcastDims(t,a),g=k.getBroadcastDims(e,a);if(x.length+g.length===0)for(let y=0;y<u.length;++y)u[y]=r(o[y%o.length],n[y%n.length]);else for(let y=0;y<u.length;++y){let v=b.indexToLoc(y,i,c),N=v.slice(-p);x.forEach(_=>N[_]=0);let S=b.locToIndex(N,p,f),R=v.slice(-m);g.forEach(_=>R[_]=0);let A=b.locToIndex(R,m,d);u[y]=r(o[S],n[A])}return[u,a]}}var we=h(()=>{I();});function Ee(r){let{inputs:t,backend:e}=r,{real:o,imag:n}=t,s=e.data.get(o.dataId).values,a=e.data.get(n.dataId).values,i=e.makeTensorInfo(o.shape,"complex64"),c=e.data.get(i.dataId);return c.complexTensorInfos={real:e.makeTensorInfo(o.shape,"float32",s),imag:e.makeTensorInfo(n.shape,"float32",a)},i}var i$,yn=h(()=>{I();i$={kernelName:Ci,backendName:"cpu",kernelFunc:Ee}});function kl(r,t,e="float32"){if(e==="complex64"){let n=kl(r,t,"float32"),s=kl(r,t,"float32");return Ee({inputs:{real:n,imag:s},backend:r})}let o=b.makeZerosTypedArray(b.sizeFromShape(t),e);return r.makeTensorInfo(t,e,o)}var xb=h(()=>{I();yn();});function Qe(r){let{inputs:t,backend:e}=r,{x:o}=t;return e.incRef(o.dataId),{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}var c$,qo=h(()=>{I();c$={kernelName:$n,backendName:"cpu",kernelFunc:Qe}});function co(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.data.get(o.dataId).complexTensorInfos.real,s=e.data.get(n.dataId).values;return e.makeTensorInfo(n.shape,n.dtype,s)}var l$,Ka=h(()=>{I();l$={kernelName:gc,backendName:"cpu",kernelFunc:co}});function yb(r,t,e,o){if(o==="int32"){let n=Int32Array.from(r);return[t,"int32",n]}if(o==="bool"){let n=b.toTypedArray([0],e),[s,a]=Rt((i,c)=>i!==c?1:0)(t,[],r,n,"bool");return[a,"bool",s]}throw new Error(`Error in Cast: failed to cast ${e} to ${o}`)}function lo(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dtype:s}=o;if(s==="complex64"){if(n.dtype==="complex64")return Qe({inputs:{x:n},backend:e});let u=kl(e,n.shape,n.dtype),p=lo({inputs:{x:n},backend:e,attrs:{dtype:"float32"}}),m=Ee({inputs:{real:p,imag:u},backend:e});return e.disposeIntermediateTensorInfo(u),e.disposeIntermediateTensorInfo(p),m}if(n.dtype==="complex64"){let u=co({inputs:{input:n},backend:e}),p=lo({inputs:{x:u},backend:e,attrs:{dtype:s}});return e.disposeIntermediateTensorInfo(u),p}if(!b.hasEncodingLoss(n.dtype,s)){let u=Qe({inputs:{x:n},backend:e});return{dataId:u.dataId,shape:u.shape,dtype:s}}let a=e.data.get(n.dataId).values,[i,c,l]=yb(a,n.shape,n.dtype,s);return e.makeTensorInfo(i,c,l)}var u$,qa=h(()=>{I();we();xb();yn();qo();Ka();u$={kernelName:En,backendName:"cpu",kernelFunc:lo}});function Ot(r,t,e,o){return e==null?({inputs:n,backend:s})=>{let{a,b:i}=n,c=s;Y([a,i],r);let l=c.data.get(a.dataId).values,u=c.data.get(i.dataId).values,p=a.dtype==="string"?k.fromUint8ToStringArray(l):l,m=a.dtype==="string"?k.fromUint8ToStringArray(u):u,f=o||a.dtype,[d,x]=t(a.shape,i.shape,p,m,f);return c.makeTensorInfo(x,f,d)}:({inputs:n,backend:s})=>{let{a,b:i}=n,c=s;if(a.dtype==="complex64"||i.dtype==="complex64"){let l=lo({inputs:{x:a},backend:c,attrs:{dtype:"complex64"}}),u=c.data.get(l.dataId),p=u.complexTensorInfos.real,m=u.complexTensorInfos.imag,f=c.data.get(p.dataId).values,d=c.data.get(m.dataId).values,x=lo({inputs:{x:i},backend:c,attrs:{dtype:"complex64"}}),g=c.data.get(x.dataId),y=g.complexTensorInfos.real,v=g.complexTensorInfos.imag,N=c.data.get(y.dataId).values,S=c.data.get(v.dataId).values,[R,A,_]=e(a.shape,i.shape,f,d,N,S),D=c.makeTensorInfo(_,"float32",R),L=c.makeTensorInfo(_,"float32",A),M=Ee({inputs:{real:D,imag:L},backend:c});return c.disposeIntermediateTensorInfo(l),c.disposeIntermediateTensorInfo(x),c.disposeIntermediateTensorInfo(D),c.disposeIntermediateTensorInfo(L),M}else{let l=c.data.get(a.dataId).values,u=c.data.get(i.dataId).values,p=o||a.dtype,[m,f]=t(a.shape,i.shape,l,u,p);return c.makeTensorInfo(f,p,m)}}}function El(r){return(t,e,o,n,s,a)=>{let i=k.assertAndGetBroadcastShape(t,e),c=b.sizeFromShape(i),l=i.length,u=b.computeStrides(i),p=b.getTypedArrayFromDType("float32",c),m=b.getTypedArrayFromDType("float32",c),f=k.getBroadcastDims(t,i),d=k.getBroadcastDims(e,i),x=k.mergeRealAndImagArrays(o,n),g=k.mergeRealAndImagArrays(s,a),y=t.length,v=b.computeStrides(t),N=e.length,S=b.computeStrides(e);if(f.length+d.length===0)for(let R=0;R<p.length;R++){let A=R%x.length,_=R%g.length,D=r(x[A*2],x[A*2+1],g[_*2],g[_*2+1]);p[R]=D.real,m[R]=D.imag}else for(let R=0;R<p.length;R++){let A=b.indexToLoc(R,l,u),_=A.slice(-y);f.forEach(W=>_[W]=0);let D=b.locToIndex(_,y,v),L=A.slice(-N);d.forEach(W=>L[W]=0);let M=b.locToIndex(L,N,S),V=r(x[D*2],x[D*2+1],g[M*2],g[M*2+1]);p[R]=V.real,m[R]=V.imag}return[p,m,i]}}var $e=h(()=>{I();ft();qa();yn();});var bb,g8,Xo,p$,Xa=h(()=>{I();we();$e();bb=Rt(((r,t)=>r+t)),g8=El(((r,t,e,o)=>({real:r+e,imag:t+o}))),Xo=Ot("Add",bb,g8),p$={kernelName:"Add",backendName:"cpu",kernelFunc:Xo}});function $l(r,t,e,o,n){let s=b.sizeFromShape(o),a=b.makeZerosTypedArray(n,e);for(let i=0;i<r.length;i++){let c=r[i];if(c<0)throw new Error("Input x must be non-negative!");c>=n||(s>0?a[c]+=t[i]:a[c]+=1)}return a}function ld(r,t,e,o=!1){let n=r.shape[0],s=r.shape[1],a=ut([n,e],t.dtype);for(let i=0;i<n;i++)for(let c=0;c<s;c++){let l=r.get(i,c);if(l<0)throw new Error("Input x must be non-negative!");l>=e||(o?a.set(1,i,l):t.size>0?a.set(a.get(i,l)+t.get(i,c),i,l):a.set(a.get(i,l)+1,i,l))}return a}var ud=h(()=>{I();});var vb,x8,m$,wb=h(()=>{I();we();$e();vb=Rt(((r,t)=>r&t)),x8=Ot(Cs,vb),m$={kernelName:Cs,backendName:"cpu",kernelFunc:x8}});function Pe(r){return(t,e,o)=>{let n=b.getArrayFromDType(e,t.length);for(let s=0;s<t.length;++s)n[s]=r(t[s],o);return n}}var Co=h(()=>{I();});function yt(r,t,e){let o=Pe(t);return vr(r,o,e)}function vr(r,t,e){return({inputs:o,attrs:n,backend:s})=>{let{x:a}=o;Y(a,r);let i=s,c=i.data.get(a.dataId).values,l;if(a.dtype==="string"){if(!Array.isArray(c))throw new Error("String tensor's value was not an instance of Array");l=k.fromUint8ToStringArray(c)}else l=c;let u=e||a.dtype,p=t(l,u,n);return i.makeTensorInfo(a.shape,u,p)}}var Pt=h(()=>{I();ft();Co();});var Cb,y8,f$,Sb=h(()=>{I();Co();Pt();Cb=Pe(r=>Math.ceil(r)),y8=vr(Ss,Cb),f$={kernelName:Ss,backendName:"cpu",kernelFunc:y8}});function pd(r,t,e,o){let n=b.getArrayFromDType(e,b.sizeFromShape(t));if(o&&e!=="string"){let s=0;r.forEach(a=>{let i=b.sizeFromShape(a.shape);n.set(a.vals,s),s+=i})}else{let s=0;r.forEach(a=>{let i=e==="string"?k.fromUint8ToStringArray(a.vals):a.vals,c=0;for(let l=0;l<a.shape[0];++l){let u=l*t[1]+s;for(let p=0;p<a.shape[1];++p)n[u+p]=i[c++]}s+=a.shape[1]})}return n}var Nb=h(()=>{I();});var Tb,Ib,d$,md=h(()=>{I();we();$e();Tb=Rt((r,t)=>r===t?1:0),Ib=Ot(ks,Tb,null,"bool"),d$={kernelName:ks,backendName:"cpu",kernelFunc:Ib}});var kb,Eb,h$,fd=h(()=>{I();Co();Pt();kb=Pe(r=>Math.exp(r)),Eb=vr("Exp",kb,"float32"),h$={kernelName:"Exp",backendName:"cpu",kernelFunc:Eb}});var $b,b8,g$,Rb=h(()=>{I();Co();Pt();$b=Pe(r=>Math.expm1(r)),b8=vr(Es,$b),g$={kernelName:Es,backendName:"cpu",kernelFunc:b8}});var Ab,v8,x$,_b=h(()=>{I();Co();Pt();Ab=Pe(r=>Math.floor(r)),v8=vr($s,Ab),x$={kernelName:$s,backendName:"cpu",kernelFunc:v8}});var Db,w8,y$,Fb=h(()=>{I();we();$e();Db=Rt((r,t)=>Math.floor(r/t)),w8=Ot(Rs,Db,null,"int32"),y$={kernelName:Rs,backendName:"cpu",kernelFunc:w8}});function dd(r,t,e,o,n,s,a,i,c){let l=ut([o,s],e);for(let u=0;u<o;u++){let p=[],m=0;for(let f=0;f<n;f++){let d=r[u*n+f];m+=d*a[f],p.push(d)}if(m<0||m>=c/s)throw new Error(`Invalid indices: ${p} does not index into ${i}`);for(let f=0;f<s;f++)l.values[u*s+f]=t.get(...t.indexToLoc(m*s+f))}return l}var Ob=h(()=>{I();});function hd(r,t,e){let o=ut(e,r.dtype);for(let n=0;n<o.size;++n){let a=o.indexToLoc(n).slice(),i=a[0],c=a[2],l=t.locToIndex([i,c]);a[2]=t.values[l];let u=r.locToIndex(a);0<=u&&u<r.values.length&&(o.values[n]=r.values[u])}return o}var Pb=h(()=>{I();});var Lb,C8,b$,Mb=h(()=>{I();we();$e();Lb=Rt((r,t)=>r>t?1:0),C8=Ot(As,Lb,null,"bool"),b$={kernelName:As,backendName:"cpu",kernelFunc:C8}});var Bb,S8,v$,Vb=h(()=>{I();we();$e();Bb=Rt((r,t)=>r>=t?1:0),S8=Ot(_s,Bb,null,"bool"),v$={kernelName:_s,backendName:"cpu",kernelFunc:S8}});var zb,N8,w$,Gb=h(()=>{I();we();$e();zb=Rt((r,t)=>r<t?1:0),N8=Ot(Ps,zb,null,"bool"),w$={kernelName:Ps,backendName:"cpu",kernelFunc:N8}});var Wb,T8,C$,Ub=h(()=>{I();we();$e();Wb=Rt((r,t)=>r<=t?1:0),T8=Ot(Ls,Wb,null,"bool"),C$={kernelName:Ls,backendName:"cpu",kernelFunc:T8}});function gd(r,t,e){let o=(t-r)/(e-1),n=b.makeZerosTypedArray(e,"float32");n[0]=r;for(let s=1;s<n.length;s++)n[s]=n[s-1]+o;return n}var Hb=h(()=>{I();});var Kb,I8,S$,qb=h(()=>{I();Co();Pt();Kb=Pe(r=>Math.log(r)),I8=vr("Log",Kb),S$={kernelName:"Log",backendName:"cpu",kernelFunc:I8}});function xd(r,t,e,o){let n=b.getTypedArrayFromDType(o,b.sizeFromShape(e));for(let s=0;s<n.length;++s){let a=s*t,i=r[a];for(let c=0;c<t;++c){let l=r[a+c];(Number.isNaN(l)||l>i)&&(i=l)}n[s]=i}return n}var Xb=h(()=>{I();});var jb,k8,N$,Yb=h(()=>{I();we();$e();jb=Rt(((r,t)=>Math.max(r,t))),k8=Ot(Gs,jb),N$={kernelName:Gs,backendName:"cpu",kernelFunc:k8}});var Zb,E8,T$,Qb=h(()=>{I();we();$e();Zb=Rt(((r,t)=>Math.min(r,t))),E8=Ot(Ws,Zb),T$={kernelName:Ws,backendName:"cpu",kernelFunc:E8}});var ap,$8,ja,I$,Ya=h(()=>{I();we();$e();ap=Rt(((r,t)=>r*t)),$8=El(((r,t,e,o)=>({real:r*e-t*o,imag:r*o+t*e}))),ja=Ot(Us,ap,$8),I$={kernelName:Us,backendName:"cpu",kernelFunc:ja}});function Jb(r,t,e){let o=b.createScalarValue(-1,e);return ap([],t,o,r,e)}function R8(r){let{inputs:t,backend:e}=r,{x:o}=t;Y(o,"neg");let n=e.data.get(o.dataId).values,[s,a]=Jb(n,o.shape,o.dtype);return e.makeTensorInfo(a,o.dtype,s)}var k$,t0=h(()=>{I();ft();Ya();k$={kernelName:"Neg",backendName:"cpu",kernelFunc:R8}});var e0,A8,E$,r0=h(()=>{I();we();$e();e0=Rt(((r,t)=>r!==t?1:0)),A8=Ot(Hs,e0,null,"bool"),E$={kernelName:Hs,backendName:"cpu",kernelFunc:A8}});function Rl(r,t,e,o,n){let s=t.length,a=b.sizeFromShape(t),i=b.computeStrides(t),c=b.computeStrides(n),l=b.getTypedArrayFromDType(e,b.sizeFromShape(n));for(let u=0;u<a;++u){let p=b.indexToLoc(u,s,i),m=new Array(p.length);for(let d=0;d<m.length;d++)m[d]=p[o[d]];let f=b.locToIndex(m,s,c);l[f]=r[u]}return l}var yd=h(()=>{I();});function ce(r){let{inputs:t,attrs:e,backend:o}=r,{x:n}=t,{perm:s}=e;Y(n,"transpose");let a=n.shape.length,i=new Array(a);for(let p=0;p<i.length;p++)i[p]=n.shape[s[p]];let c=o.data.get(n.dataId).values,l=Rl(c,n.shape,n.dtype,s,i);return{dataId:o.write(l,i,n.dtype),shape:i,dtype:n.dtype}}var $$,Or=h(()=>{I();ft();yd();$$={kernelName:An,backendName:"cpu",kernelFunc:ce}});function o0(r,t,e,o){let[n,s]=k.computeOutAndReduceShapes(r,o),a=be(t,"int32"),i=b.makeZerosTypedArray(b.sizeFromShape(n),a),c=b.sizeFromShape(s);for(let l=0;l<i.length;++l){let u=l*c,p=1;for(let m=0;m<c;++m)p*=e[u+m];i[l]=p}return{outVals:i,outShape:n,outDtype:a}}function _8(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;Y(n,"prod");let i=n.shape.length,c=b.parseAxisParam(s,n.shape),l=k.getAxesPermutation(c,i),u=c,p=n,m=[];l!=null&&(p=ce({inputs:{x:n},backend:e,attrs:{perm:l}}),m.push(p),u=k.getInnerMostAxes(u.length,i));let f=e.data.get(p.dataId).values,{outVals:d,outShape:x,outDtype:g}=o0(p.shape,p.dtype,f,u),y=x;return a&&(y=k.expandShapeToKeepDim(x,c)),m.forEach(v=>e.disposeIntermediateTensorInfo(v)),e.makeTensorInfo(y,g,d)}var R$,n0=h(()=>{I();ft();Or();R$={kernelName:pc,backendName:"cpu",kernelFunc:_8}});function D8(r,t,e){r.forEach((o,n)=>{if(o<0||o>=e){let s=b.indexToLoc(n,t.length,b.computeStrides(t)).join(",");throw new Error(`indices[${s}] = ${o} is not in [0, ${e})`)}})}function F8(r,t){for(let e=0;e<r.length;++e){let o=r[e],n=e===r.length-1?t:r[e+1].length;if(o.length===0)throw new Error("Ragged splits may not be empty");if(o[0]<0)throw new Error("Ragged splits must be non-negative");if(o[o.length-1]>n)throw new Error("Ragged splits must not point past values");for(let s=1;s<o.length;++s)if(o[s-1]>o[s])throw new Error("Ragged splits must be sorted in ascending order")}}function O8(r,t,e,o){let n=[],s=0,a=t.length-1+e.length,i=new Array(a).fill(null).map(()=>[0]);F8(e,o);let c=1;for(let l=0;l<t.length-1;++l){c*=t[l];let u=t[l+1];for(let p=1;p<c+1;++p)i[l].push(p*u)}for(let l=0;l<r.length;++l){let u=r[l],p=r[l]+1;for(let m=0;m<e.length;++m){let f=e[m],d=m+t.length-1;if(d>=0){let x=i[d],g=x[x.length-1]-f[u];for(let y=u;y<p;++y)i[d].push(f[y+1]+g)}u=f[u],p=f[p]}p!==u&&(n.push([u,p]),s+=p-u)}return{outSplits:i,valueSlices:n,numValues:s}}function P8(r){let t=[];for(let e=0;e<r.length;++e){let o=r[e].length,n=b.getArrayFromDType("int32",o);t.push(n),r[e].forEach((s,a)=>n[a]=s)}return t}function A$(r,t){let e=r.slice(0,t);for(;e.length<t;)e.push(1);for(let o=t;o<r.length;o++)e[t-1]*=r[o];return e}function L8(r,t,e,o,n,s){let a=A$(t,2)[1],i=A$(s,2)[1],c=0;for(let l of e)for(let u=l[0];u<l[1];++u){for(let p=0;p<o;++p)n[c*i+p]=r[u*a+p];++c}}function M8(r,t,e,o,n){let s=t.slice();s[0]=n;let a=b.getArrayFromDType(e,b.sizeFromShape(s)),i=r.length,c=i===0?0:i/t[0];return L8(r,t,o,c,a,s),[a,s]}function bd(r,t,e,o,n,s,a,i){if(r.length===0)throw new Error("paramsNestedSplits must be non empty");if(t[0].length===0)throw new Error("Split tensors must not be scalars");let c=t[0][0]-1;if(D8(s,a,c),o.length===0)throw new Error("params.rank must be nonzero");let l=o[0],{outSplits:u,valueSlices:p,numValues:m}=O8(s,a,r,l),f=P8(u),d=M8(e,o,n,p,m);return[f,d[0],d[1]]}var s0=h(()=>{I();});function vd(r,t,e,o,n,s,a){if(t.length>1)throw new Error("starts must be a scalar or vector");if(n.length>1)throw new Error("limits must be a scalar or vector");if(a.length>1)throw new Error("deltas must be a scalar or vector");let i=t.length===0,c=n.length===0,l=a.length===0,u=[];i||u.push(t[0]),c||u.push(n[0]),l||u.push(a[0]);for(let g=1;g<u.length;++g)if(u[g]!==u[g-1])throw new Error("starts, limits, and deltas must have the same shape");let p=u.length===0?1:u[0],m=b.getArrayFromDType("int32",p+1);m[0]=0;for(let g=0;g<p;++g){let y=i?r[0]:r[g],v=c?o[0]:o[g],N=l?s[0]:s[g];if(N===0)throw new Error("Requires delta != 0");let S;if(N>0&&v<y||N<0&&v>y)S=0;else if(S=Math.ceil(Math.abs((v-y)/N)),S>_$)throw new Error(`Requires ((limit - start) / delta) <= ${_$}`);m[g+1]=m[g]+S}let f=m[p],d=b.getArrayFromDType(e,f),x=0;for(let g=0;g<p;++g){let y=m[g+1]-m[g],v=i?r[0]:r[g],N=l?s[0]:s[g];for(let S=0;S<y;++S)d[x++]=v,v+=N}return[m,d]}var _$,a0=h(()=>{I();_$=2147483647});function D$(r,t,e){for(let o=0;o<e;o++)r[o]=t[o]}function F$(r,t){let e=[];for(let o of r){if(o<0){if(!t)throw new Error(`Dimension ${o} must be >= 0`);if(o<-1)throw new Error(`Dimension ${o} must be >= -1`);o=-1}e.push(o)}return e}function wd(r,t,e,o,n,s,a,i,c,l){return new i0(r,t,e,o,n,s,a,i,c,l).compute()}var uo,i0,c0=h(()=>{I();uo=k.RowPartitionType,i0=class r{constructor(t,e,o,n,s,a,i,c,l,u){this.shape=t,this.shapeShape=e,this.values=o,this.valuesShape=n,this.valuesDType=s,this.defaultValue=a,this.defaultValueShape=i,this.rowPartitionValues=c,this.rowPartitionValuesShapes=l,this.rowPartitionTypes=k.getRowPartitionTypesHelper(u),this.raggedRank=k.getRaggedRank(this.rowPartitionTypes)}getRowPartitionTypeByDimension(t){return this.rowPartitionTypes[0]===uo.FIRST_DIM_SIZE?this.rowPartitionTypes[t+1]:this.rowPartitionTypes[t]}getRowPartitionTensor(t){return this.rowPartitionTypes[0]===uo.FIRST_DIM_SIZE?this.rowPartitionValues[t+1]:this.rowPartitionValues[t]}getMaxWidth(t){let e=this.getRowPartitionTensor(t-1);switch(this.getRowPartitionTypeByDimension(t-1)){case uo.VALUE_ROWIDS:return r.getMaxWidthValueRowID(e);case uo.ROW_SPLITS:return r.getMaxWidthRowSplit(e);default:throw new Error(`Cannot handle partition type ${uo[this.getRowPartitionTypeByDimension(t-1)]}`)}}static getMaxWidthRowSplit(t){let e=t.length;if(e===0||e===1)return 0;let o=0;for(let n=0;n<e-1;++n){let s=t[n+1]-t[n];s>o&&(o=s)}return o}static getMaxWidthValueRowID(t){let e=t.length;if(e===0)return 0;let o=0,n=t[0],s=0;for(let a=1;a<e;++a){let i=t[a];i!==n&&(n=i,s=Math.max(a-o,s),o=a)}return Math.max(e-o,s)}tensorShapeFromTensor(t,e,o=!0){if(e.length===0){if(t[0]===-1)return[];throw new Error("The only valid scalar shape tensor is the fully unknown shape specified as -1.")}return F$(t,o)}calculateOutputSize(t){let e=this.valuesShape,o=this.defaultValueShape;k.validateDefaultValueShape(o,e);let n=this.tensorShapeFromTensor(this.shape,this.shapeShape),a=k.combineRaggedTensorToTensorShapes(this.raggedRank,n,e);a[0]<0&&(a[0]=t);for(let i=1;i<=this.raggedRank;++i)a[i]<0&&(a[i]=this.getMaxWidth(i));return a}calculateFirstParentOutputIndex(t,e,o){let n=Math.min(t,o),s=[],a=0;for(let i=0;i<n;++i,a+=e)s.push(a);for(let i=n;i<t;++i)s.push(-1);return b.assert(s.length===t,()=>"Final length of result must be equal to firstDimension."),s}calculateOutputIndexRowSplit(t,e,o,n){let s=t.length,a=[];for(let i=0;i<s-1;++i){let c=t[i+1]-t[i],l=Math.min(n,c),u=e[i];u===-1&&(l=0);for(let p=0;p<l;++p)a.push(u),u+=o;for(let p=0;p<c-l;++p)a.push(-1)}if(s>0&&a.length!==t[s-1])throw new Error("Invalid row split size.");return a}calculateOutputIndexValueRowID(t,e,o,n){let s=t.length,a=[];if(s===0)return[];let i=0,c=t[0];if(c>=e.length)throw new Error(`Got currentValueRowId=${c}, which is not less than ${e.length}`);let l=e[c];a.push(l);for(let u=1;u<s;++u){let p=t[u];if(p===c)l>=0&&(++i,i<n?l+=o:l=-1);else{if(i=0,c=p,p>=e.length)throw new Error(`Got nextValueRowId=${p} which is not less than ${e.length}`);l=e[p]}a.push(l)}if(a.length!==t.length)throw new Error("Invalid row ids.");return a}calculateOutputIndex(t,e,o,n){let s=this.getRowPartitionTensor(t),a=this.getRowPartitionTypeByDimension(t);switch(a){case uo.VALUE_ROWIDS:return this.calculateOutputIndexValueRowID(s,e,o,n);case uo.ROW_SPLITS:if(s.length-1>e.length)throw new Error(`Row partition size is greater than output size: ${s.length-1} > ${e.length}`);return this.calculateOutputIndexRowSplit(s,e,o,n);default:throw new Error(`Unsupported partition type: ${uo[a]}`)}}getFirstDimensionSize(){let t=this.rowPartitionValues[0];if(this.rowPartitionTypes.length===0)throw new Error("No row_partition_types given.");let e=this.rowPartitionTypes[0];switch(e){case uo.FIRST_DIM_SIZE:return t[0];case uo.VALUE_ROWIDS:throw new Error("Cannot handle VALUE_ROWIDS in first dimension.");case uo.ROW_SPLITS:return this.rowPartitionValuesShapes[0][0]-1;default:throw new Error(`Cannot handle type ${uo[e]}`)}}compute(){if(this.rowPartitionValues[0].length<=0)throw new Error("Invalid first partition input. Tensor requires at least one element.");let e=this.getFirstDimensionSize(),o=this.calculateOutputSize(e),n=new Array(this.raggedRank+1);n[n.length-1]=1;for(let c=n.length-2;c>=0;--c)n[c]=n[c+1]*o[c+1];let s=F$(o,!1),a=b.getArrayFromDType(this.valuesDType,b.sizeFromShape(s));if(n[0]*o[0]>0){let c=this.calculateFirstParentOutputIndex(e,n[0],o[0]);for(let l=1;l<=this.raggedRank;++l)c=this.calculateOutputIndex(l-1,c,n[l],o[l]);this.setOutput(this.raggedRank,c,a,s)}return[s,a]}setOutput(t,e,o,n){if(o.length===0)return;let s=this.values,a=o,i=n.slice();i=i.slice(t+1);let c=b.sizeFromShape(i),l=e.length,u=this.defaultValue;if(u.length!==c&&u.length!==1){let d=this.defaultValueShape;Tt(()=>{let x=z(u,d);u=Gn(x,i).dataSync()})}let p=0,m=0,f=0;for(let d=0;d<=l;++d){let x=d<l?e[d]:-1;if(x===f){++f;continue}if(m<f){let g=s.subarray(p*c),y=a.subarray(m*c),v=(f-m)*c;D$(y,g,v)}if(d>=l){let g=o.length;x=Math.floor(g/c)}if(x>f)if(this.defaultValue.length===1)a.subarray(f*c,x*c).fill(this.defaultValue[0]),f=x;else for(;x>f;){let g=a.slice(f*c);D$(g,u,c),++f}x<0?(p=d+1,m=f):(p=d,m=f,f=m+1)}}}});function Cd(r,t,e,o){let n=r===t,s=r<t&&e<0,a=t<r&&e>1;if(n||s||a)return b.makeZerosTypedArray(0,o);let i=Math.abs(Math.ceil((t-r)/e)),c=b.makeZerosTypedArray(i,o);t<r&&e===1&&(e=-1),c[0]=r;for(let l=1;l<c.length;l++)c[l]=c[l-1]+e;return c}var l0=h(()=>{I();});var u0,B8,O$,p0=h(()=>{I();Co();Pt();u0=Pe(r=>1/Math.sqrt(r)),B8=vr(Ys,u0),O$={kernelName:Ys,backendName:"cpu",kernelFunc:B8}});function So(r,t,e,o,n,s,a,i,c,l){let u=[o/n,n],p=r.values,m=t.values;if(o===0)return ut(e,t.dtype);let f=c instanceof Bt?c:ut(u,t.dtype);typeof c=="string"||typeof c=="number"?f.values.fill(c):typeof c=="boolean"&&f.values.fill(+c);for(let d=0;d<s;d++){let x=[],g=0;for(let y=0;y<a;y++){let v=p[d*a+y];x.push(v),g+=v*i[y]}if(g<0||g>=o/n)throw new Error(`Invalid indices: ${x} does not index into ${e}`);for(let y=0;y<n;y++)l?f.values[g*n+y]+=m[d*n+y]:f.values[g*n+y]=t.rank===0?m[0]:m[d*n+y]}return f}var ip=h(()=>{I();});var P$,m0,L$,Sd=h(()=>{I();Co();Pt();P$=Pe(r=>1/(1+Math.exp(-r))),m0=yt(ta,r=>1/(1+Math.exp(-r))),L$={kernelName:ta,backendName:"cpu",kernelFunc:m0}});function f0(r,t,e,o,n){let s=Fe.isSliceContinous(o,t,e),a=b.sizeFromShape(e),i=b.computeStrides(o);if(s){let p=Fe.computeFlatOffset(t,i);return n==="string"?r.slice(p,p+a):r.subarray(p,p+a)}let c=n==="string"?k.fromUint8ToStringArray(r):r,l=ut(o,n,c),u=ut(e,n);for(let p=0;p<u.size;++p){let m=u.indexToLoc(p),f=m.map((d,x)=>d+t[x]);u.set(l.get(...f),...m)}return n==="string"?k.fromStringArrayToUint8(u.values):u.values}function po(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,size:a}=o;Y(n,"slice");let[i,c]=Fe.parseSliceParams(n,s,a);Fe.assertParamsValid(n,i,c);let l=e.data.get(n.dataId).values,u=f0(l,i,c,n.shape,n.dtype);return e.makeTensorInfo(c,n.dtype,u)}var M$,ts=h(()=>{I();ft();M$={kernelName:Tc,backendName:"cpu",kernelFunc:po}});function Nd(r,t,e,o,n,s,a){let i=t[0],c=s[0],l=new Array(c),u=new Array(i),p=t[1];if(c===0){if(i!==0)throw new Error(k.getSparseFillEmptyRowsIndicesDenseShapeMismatch(i));let g=b.getArrayFromDType(e,0),y=b.getArrayFromDType(n,0);return[g,[0,p],y,l,u]}let m=!0,f=0,d=new Array(c).fill(0);for(let g=0;g<i;++g){let y=r[g*p];if(y<0)throw new Error(k.getSparseFillEmptyRowsNegativeIndexErrorMessage(g,y));if(y>=c)throw new Error(k.getSparseFillEmptyRowsOutOfRangeIndexErrorMessage(g,y,c));++d[y],m=m&&y>=f,f=y}let x=!0;for(let g=0;g<c;++g){let y=d[g]===0;l[g]=y,x=x&&!y,d[g]=Math.max(d[g],1),g>0&&(d[g]+=d[g-1])}if(x&&m){let g=r,y=o;for(let v=0;v<i;++v)u[v]=v;return[g,[i,p],y,l,u]}else{let g=d[c-1],y=b.getArrayFromDType(e,g*p),v=b.getArrayFromDType(n,g),N=new Array(c).fill(0);for(let S=0;S<i;++S){let R=r[S*p],A=N[R],_=(R===0?0:d[R-1])+A;N[R]++;for(let D=0;D<p;++D)y[_*p+D]=r[S*p+D];v[_]=o[S],u[S]=_}for(let S=0;S<c;++S)if(N[S]===0){let A=S===0?0:d[S-1];y[A*p+0]=S;for(let _=1;_<p;++_)y[A*p+_]=0;v[A]=a}return[y,[g,p],v,l,u]}}var d0=h(()=>{I();});function Td(r,t,e,o,n){let s=b.sizeFromShape(o),a=t[0],i=n.length,c=[],l=1,u=-1;for(let g=0;g<i;++g){let y=n[g];if(y===-1){if(u!==-1)throw new Error(k.getSparseReshapeMultipleNegativeOneOutputDimErrorMessage(u,g));u=g,c.push(1)}else{if(y<0)throw new Error(k.getSparseReshapeNegativeOutputDimErrorMessage(g,y));l*=y,c.push(y)}}if(u!==-1){if(l<=0)throw new Error(k.getSparseReshapeEmptyTensorZeroOutputDimErrorMessage());let g=Math.trunc(s/l);if(l*g!==s)throw new Error(k.getSparseReshapeInputOutputMultipleErrorMessage(o,c));c[u]=g}if(b.sizeFromShape(c)!==s)throw new Error(k.getSparseReshapeInputOutputMismatchErrorMessage(o,c));let m=o.length,f=[];if(m>0){f[m-1]=1;for(let g=m-2;g>=0;--g)f[g]=f[g+1]*o[g+1]}let d=[];if(i>0){d[i-1]=1;for(let g=i-2;g>=0;--g)d[g]=d[g+1]*c[g+1]}let x=b.getArrayFromDType(e,a*i);for(let g=0;g<a;++g){let y=0;for(let v=0;v<m;++v)y+=r[g*m+v]*f[v];for(let v=0;v<i;++v)x[g*i+v]=Math.trunc(y/d[v]),y%=d[v]}return[x,[a,i],c]}var h0=h(()=>{I();});function Al(r,t,e,o,n,s=!1,a=0){let i=o.length,c=[t[0],r.length/t[0]],l=c[1],p=i>0?n[i-1]+1:0;if(p<0)throw new Error(k.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let m=t.slice();m[0]=p;let f=m.reduce((N,S)=>N*S,1),d=b.getArrayFromDType(e,f);if(i===0)return p>0&&d.fill(a),[d,m];if(p<=0)throw new Error(k.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let x=0,g=1,y=0,v=n[x];for(;;){let N=0;if(g<i){if(N=n[g],v===N){++g;continue}if(v>=N)throw new Error(k.getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage())}if(v<0||v>=p)throw new Error(k.getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage(v,p));v>y&&d.fill(a,y*l,v*l);for(let S=x;S<g;++S){let R=o[S];if(R<0||R>=c[0])throw new Error(k.getSparseSegmentReductionIndicesOutOfRangeErrorMessage(S,o[S],c[0]));for(let A=0;A<l;A++)d[v*l+A]+=r[R*l+A]}if(s)for(let S=0;S<l;S++)d[v*l+S]/=g-x;if(x=g,++g,y=v+1,v=N,g>i)break}return y<p&&d.fill(a,y*l,p*l),[d,m]}var Id=h(()=>{I();});var B$,V8,V$,g0=h(()=>{I();Co();Pt();B$=Pe(r=>Math.sqrt(r)),V8=yt(ra,r=>Math.sqrt(r)),V$={kernelName:ra,backendName:"cpu",kernelFunc:V8}});var x0,z8,z$,y0=h(()=>{I();we();$e();x0=Rt(((r,t)=>{let e=r-t;return e*e})),z8=Ot(oa,x0),z$={kernelName:oa,backendName:"cpu",kernelFunc:z8}});var b0,G8,G$,v0=h(()=>{I();Co();Pt();b0=Pe((r,t)=>{let{pattern:e,replaceGlobal:o,rewrite:n}=t;return r.replace(new RegExp(e,o?"g":""),n)}),G8=vr(na,b0),G$={kernelName:na,backendName:"cpu",kernelFunc:G8}});function kd(r,t,e,o){let n=ut(r,t.dtype);for(let s=0;s<n.size;s++){let a=n.indexToLoc(s),i=new Array(a.length);for(let c=0;c<i.length;c++)i[c]=a[c]*e[c]+o[c];n.set(t.get(...i),...a)}return n}var w0=h(()=>{I();});function Ed(r,t,e,o,n,s,a,i){return new C0(e,o,n,s,a,i).compute(r,t)}var C0,S0=h(()=>{I();C0=class{constructor(t,e,o,n,s,a){this.separator=b.encodeString(t),this.nGramWidths=e,this.leftPad=b.encodeString(o),this.rightPad=b.encodeString(n),this.padWidth=s,this.preserveShort=a}getPadWidth(t){return Math.min(this.padWidth<0?t-1:this.padWidth,t-1)}getNumNGrams(t,e){let o=this.getPadWidth(e);return Math.max(0,t+2*o-e+1)}createNGrams(t,e,o,n,s,a){for(let i=0;i<s;++i){let c=this.getPadWidth(a),l=Math.max(0,c-i),u=Math.max(0,c-(s-(i+1))),p=a-(l+u),m=e+(l>0?0:i-c),f=0;f+=l*this.leftPad.length;for(let v=0;v<p;++v)f+=t[m+v].length;f+=u*this.rightPad.length;let d=l+u+p-1;f+=d*this.separator.length,o[n+i]=new Uint8Array(f);let x=o[n+i],g=0,y=v=>v.forEach(N=>x[g++]=N);for(let v=0;v<l;++v)y(this.leftPad),y(this.separator);for(let v=0;v<p-1;++v)y(t[m+v]),y(this.separator);if(p>0){y(t[m+p-1]);for(let v=0;v<u;++v)y(this.separator),y(this.rightPad)}else{for(let v=0;v<u-1;++v)y(this.rightPad),y(this.separator);y(this.rightPad)}}}compute(t,e){let o=t.length,n=e.length;if(n>0){let c=e[0];if(c!==0)throw new Error(`First split value must be 0, got ${c}`);for(let l=1;l<n;++l){let u=e[l]>=c;if(u=u&&e[l]<=o,!u)throw new Error(`Invalid split value ${e[l]}, must be in [${c}, ${o}]`);c=e[l]}if(c!==o)throw new Error(`Last split value must be data size. Expected ${o}, got ${c}`)}let s=n-1,a=b.getArrayFromDType("int32",n);if(o===0||n===0){let c=new Array(o);for(let l=0;l<=s;++l)a[l]=0;return[c,a]}a[0]=0;for(let c=1;c<=s;++c){let l=e[c]-e[c-1],u=0;this.nGramWidths.forEach(p=>{u+=this.getNumNGrams(l,p)}),this.preserveShort&&l>0&&u===0&&(u=1),a[c]=a[c-1]+u}let i=new Array(a[s]);for(let c=0;c<s;++c){let l=e[c],u=a[c];if(this.nGramWidths.forEach(p=>{let m=e[c+1]-e[c],f=this.getNumNGrams(m,p);this.createNGrams(t,l,i,u,f,p),u+=f}),this.preserveShort&&u===a[c]){let p=e[c+1]-e[c];if(p===0)continue;let m=p+2*this.padWidth;this.createNGrams(t,l,i,u,1,m)}}return[i,a]}}});function W8(r,t,e,o){if(!r.length)return;if(t.length===0){for(let s=0;s<r.length;++s)o.push(r.subarray(s,s+1));return}if(t.length===1){let s=t[0],a=r.indexOf(s);for(;a!==-1;){let i=r.subarray(0,a);(!e||i.length!==0)&&o.push(i),r=r.subarray(a+1),a=r.indexOf(s)}(!e||r.length!==0)&&o.push(r);return}let n=0;for(let s=0;s<r.length+1;s++)if(s===r.length||t.indexOf(r[s])!==-1){let a=r.subarray(n,s);(!e||a.length!==0)&&o.push(a),n=s+1}}function $d(r,t,e){let o=r.length,n=[],s=0,a=0,i=new Array(o);for(let m=0;m<o;++m){let f=n.length;W8(r[m],t,e,n);let d=n.length-f;i[m]=d,s+=d,a=Math.max(a,d)}let c=b.getArrayFromDType("int32",s*2),l=new Array(s),u=[o,a],p=0;for(let m=0;m<o;++m)for(let f=0;f<i[m];++f)c[p*2]=m,c[p*2+1]=f,l[p]=n[p],++p;return[c,l,u]}var N0=h(()=>{I();});function Rd(r,t){let e=b.getArrayFromDType("int32",r.length);for(let o=0;o<r.length;++o)e[o]=b.fingerPrint64(r[o]).modulo(t).getLowBitsUnsigned();return e}var T0=h(()=>{I();});var I0,U8,cp,W$,lp=h(()=>{I();we();$e();I0=Rt(((r,t)=>r-t)),U8=El(((r,t,e,o)=>({real:r-e,imag:t-o}))),cp=Ot("Sub",I0,U8),W$={kernelName:"Sub",backendName:"cpu",kernelFunc:cp}});function Ad(r,t){let e=new Array(r.rank);for(let n=0;n<e.length;n++)e[n]=r.shape[n]*t[n];let o=ut(e,r.dtype);for(let n=0;n<o.values.length;++n){let s=o.indexToLoc(n),a=new Array(r.rank);for(let c=0;c<a.length;c++)a[c]=s[c]%r.shape[c];let i=r.locToIndex(a);o.values[n]=r.values[i]}return o}var k0=h(()=>{I();});function U$(r,t,e=0,o=r.length-1){for(;o>e;){if(o-e>600){let i=o-e+1,c=t-e+1,l=Math.log(i),u=.5*Math.exp(2*l/3),p=.5*Math.sqrt(l*u*(i-u)/i)*Math.sign(c-i/2),m=Math.max(e,Math.floor(t-c*u/i+p)),f=Math.min(o,Math.floor(t+(i-c)*u/i+p));U$(r,t,m,f)}let n=r[t],s=e,a=o;for(b.swap(r,e,t),up(r[o],n)>0&&b.swap(r,e,o);s<a;){for(b.swap(r,s,a),s++,a--;up(r[s],n)<0;)s=s+1;for(;up(r[a],n)>0;)a=a-1}up(r[e],n)===0?b.swap(r,e,a):(a=a+1,b.swap(r,a,o)),a<=t&&(e=a+1),t<=a&&(o=a-1)}}function _d(r,t,e,o,n){let s=t[t.length-1],[a,i]=[r.length/s,s],c=b.getTypedArrayFromDType(e,a*o),l=b.getTypedArrayFromDType("int32",a*o);for(let p=0;p<a;p++){let m=p*i,f=r.subarray(m,m+i),d=new Array(f.length);f.forEach((v,N)=>d[N]={value:v,index:N}),o<d.length&&(U$(d,o),d=d.slice(0,o)),n&&d.sort(up);let x=p*o,g=c.subarray(x,x+o),y=l.subarray(x,x+o);for(let v=0;v<o;v++)g[v]=d[v].value,y[v]=d[v].index}let u=t.slice();return u[u.length-1]=o,[ut(u,e,c),ut(u,"int32",l)]}var up,E0=h(()=>{I();up=(r,t)=>{let e=t.value-r.value;return e===0?r.index-t.index:e}});function Dd(r,t,e,o){let n=b.parseAxisParam(t,e)[0],s=[1,e[0],1];for(let d=0;d<n;d++)s[0]*=e[d];s[1]=e[n];for(let d=n+1;d<e.length;d++)s[2]*=e[d];let a=new Map,i=new Int32Array(e[n]),c=new Bt(s,o,r),l=[],u=s[0]===1&&s[2]===1;for(let d=0;d<e[n];d++){let x;if(u)x=r[d].toString();else{let y=[];for(let v=0;v<s[0];v++)for(let N=0;N<s[2];N++)y.push(c.get(v,d,N));x=y.join(",")}let g=a.get(x);if(g!=null)i[d]=g;else{let y=a.size;a.set(x,y),i[d]=y,l.push(d)}}let p=s.slice();p[1]=a.size;let m=new Bt(p,o);l.forEach((d,x)=>{for(let g=0;g<s[0];g++)for(let y=0;y<s[2];y++)m.set(c.get(g,d,y),g,x,y)});let f=e.slice();return f[n]=p[1],{outputValues:m.values,outputShape:f,indices:i}}var $0=h(()=>{I();});var R0={};Yt(R0,{addImpl:()=>bb,bincountImpl:()=>$l,bincountReduceImpl:()=>ld,bitwiseAndImpl:()=>vb,castImpl:()=>yb,ceilImpl:()=>Cb,concatImpl:()=>pd,equalImpl:()=>Tb,expImpl:()=>kb,expm1Impl:()=>$b,floorDivImpl:()=>Db,floorImpl:()=>Ab,gatherNdImpl:()=>dd,gatherV2Impl:()=>hd,greaterEqualImpl:()=>Bb,greaterImpl:()=>Lb,lessEqualImpl:()=>Wb,lessImpl:()=>zb,linSpaceImpl:()=>gd,logImpl:()=>Kb,maxImpl:()=>xd,maximumImpl:()=>jb,minimumImpl:()=>Zb,multiplyImpl:()=>ap,negImpl:()=>Jb,notEqualImpl:()=>e0,prodImpl:()=>o0,raggedGatherImpl:()=>bd,raggedRangeImpl:()=>vd,raggedTensorToTensorImpl:()=>wd,rangeImpl:()=>Cd,rsqrtImpl:()=>u0,scatterImpl:()=>So,sigmoidImpl:()=>P$,simpleAbsImpl:()=>hb,sliceImpl:()=>f0,sparseFillEmptyRowsImpl:()=>Nd,sparseReshapeImpl:()=>Td,sparseSegmentReductionImpl:()=>Al,sqrtImpl:()=>B$,squaredDifferenceImpl:()=>x0,staticRegexReplaceImpl:()=>b0,stridedSliceImpl:()=>kd,stringNGramsImpl:()=>Ed,stringSplitImpl:()=>$d,stringToHashBucketFastImpl:()=>Rd,subImpl:()=>I0,tileImpl:()=>Ad,topKImpl:()=>_d,transposeImpl:()=>Rl,uniqueImpl:()=>Dd});var H$=h(()=>{gb();Xa();ud();wb();qa();Sb();Nb();md();fd();Rb();_b();Fb();Ob();Pb();Mb();Vb();Gb();Ub();Hb();qb();Xb();Yb();Qb();Ya();t0();r0();n0();s0();a0();c0();l0();p0();ip();Sd();ts();d0();h0();Id();g0();y0();v0();w0();S0();N0();T0();lp();k0();E0();yd();$0();});var K$,Fd,q$,X$,j$,Y$,Z$,Q$,J$,tR,eR,rR,oR,nR,sR,aR,iR,cR,lR,uR,pR,mR,fR,dR,hR,gR,xR,yR,bR,vR,wR,CR,SR,Od,NR,TR,IR,Pd,kR,ER,$R,RR,AR,_R,DR,FR,OR,Za,PR,Nt=h(()=>{H$();({addImpl:K$,bincountImpl:Fd,bincountReduceImpl:q$,bitwiseAndImpl:X$,castImpl:j$,ceilImpl:Y$,concatImpl:Z$,equalImpl:Q$,expImpl:J$,expm1Impl:tR,floorImpl:eR,gatherNdImpl:rR,gatherV2Impl:oR,greaterImpl:nR,greaterEqualImpl:sR,lessImpl:aR,lessEqualImpl:iR,linSpaceImpl:cR,logImpl:lR,maxImpl:uR,maximumImpl:pR,minimumImpl:mR,multiplyImpl:fR,negImpl:dR,notEqualImpl:hR,prodImpl:gR,raggedGatherImpl:xR,raggedRangeImpl:yR,raggedTensorToTensorImpl:bR,rangeImpl:vR,rsqrtImpl:wR,scatterImpl:CR,sigmoidImpl:SR,simpleAbsImpl:Od,sliceImpl:NR,sparseFillEmptyRowsImpl:TR,sparseReshapeImpl:IR,sparseSegmentReductionImpl:Pd,sqrtImpl:kR,staticRegexReplaceImpl:ER,stridedSliceImpl:$R,stringNGramsImpl:RR,stringSplitImpl:AR,stringToHashBucketFastImpl:_R,subImpl:DR,tileImpl:FR,topKImpl:OR,transposeImpl:Za,uniqueImpl:PR}=R0)});function A0(r,t){return["x","y","z","w","u","v"].slice(0,t).map(e=>`${r}.${e}`)}function he(r,t){return t===1?[r]:A0(r,t)}function LR(r,t){if(r===1)return"rc";let e="";for(let o=0;o<r;o++)e+=t[o],o<r-1&&(e+=",");return e}var No=h(()=>{});var Ld,MR=h(()=>{Oe();No();de();Ld=class{constructor(t){if(this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.outputShape=t,this.rank=t.length,this.enableShapeUniforms=qt(this.outputShape.length),this.rank===0)this.userCode=`
        void main() {
          setOutput(vec4(getA(), 0., 0., 0.));
        }
      `;else{let e=he("rc",this.rank),o=St(this.rank),n=this.getOutOfBoundsCondition(e),s=this.getSetup(e),a=this.getOutput(e);this.userCode=`
        void main() {
          ${o} rc = getOutputCoords();

          if(${n}) {
            setOutput(vec4(0));
          } else {
            ${s}

            setOutput(vec4(${a}));
          }
        }
      `}}getSourceCoordsArr(t){let e=[];for(let o=0;o<=1;o++)for(let n=0;n<=1;n++){let s=`${o===0?"r":"rp1"}, ${n===0?"c":"cp1"}`;for(let a=2;a<this.rank;a++)s=`${t[t.length-1-a]},`+s;e.push(s)}return e}getOutOfBoundsCondition(t){if(this.rank===1)return`rc > ${this.enableShapeUniforms?"outShape":this.outputShape[0]}`;let e="";for(let o=this.rank-2;o<this.rank;o++)e+=`${t[o]} >= ${this.enableShapeUniforms?`outShape[${o}]`:this.outputShape[o]}`,o<this.rank-1&&(e+="||");return e}getSetup(t){if(this.rank===1)return"";let e=t.slice(-2),o=this.enableShapeUniforms?`outShape[${this.rank} - 1]`:this.outputShape[this.rank-1],n=this.enableShapeUniforms?`outShape[${this.rank} - 2]`:this.outputShape[this.rank-2];return`
      int r = ${e[0]};
      int c = ${e[1]};
      int rp1 = r + 1;
      int cp1 = c + 1;

      bool cEdge = cp1 >= ${o};
      bool rEdge = rp1 >= ${n};
    `}getOutput(t){let e=this.getSourceCoordsArr(t);return this.rank===1?`getA(rc), (rc + 1 >= ${this.enableShapeUniforms?"outShape":this.outputShape[0]} ? 0. : getA(rc + 1)), 0, 0`:`getA(${e[0]}),
            cEdge ? 0. : getA(${e[1]}),
            rEdge ? 0. : getA(${e[2]}),
            rEdge || cEdge ? 0. : getA(${e[3]})`}}});function H8(r,t){return`
    ivec3 inputCoordsFromReshapedOutCoords(int index) {
      ${t?E2(["r","c","d"],"inputShape"):wo(["r","c","d"],r)}
      return ivec3(r, c, d);
    }
  `}var _l,_0=h(()=>{Oe();xn();_l=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"inputShape",type:"ivec3"}],this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length);let o="";for(let n=0;n<4;n++){let s="thisRC = rc;";n%2===1&&(s+="thisRC.z += 1;"),n>1&&(s+="thisRC.y += 1;"),o+=`
        ${s}
        ${n>0?"if(thisRC.y < rows && thisRC.z < cols){":""}
          int flatIndex = getFlatIndex(thisRC);

          ivec3 inputRC = inputCoordsFromReshapedOutCoords(flatIndex);
          vec2 inputRCInnerDims = vec2(float(inputRC.y),float(inputRC.z));

          result[${n}] =
            getChannel(getA(inputRC.x, inputRC.y, inputRC.z), inputRCInnerDims);
        ${n>0?"}":""}
      `}this.userCode=`
      ${H8(e,this.enableShapeUniforms)}
      ${this.enableShapeUniforms?vl():bl(t)}

      void main() {
        ivec3 rc = getOutputCoords();

        vec4 result = vec4(0.);

        ivec3 thisRC;
        int rows = ${this.enableShapeUniforms?"outShape[1]":t[1]};
        int cols = ${this.enableShapeUniforms?"outShape[2]":t[2]};

        ${o}

        setOutput(result);
      }
    `}}});function K8(r,t){let e=r;if(t===e.R32F)return 4;if(t===e.R16F)return 2;if(t===e.RGBA32F)return 16;if(t===r.RGBA)return 16;if(t===e.RGBA16F)return 8;if(t===e.RGBA8)return 4;throw new Error(`Unknown internal format ${t}`)}function BR(r,t,e,o,n){let s=q8(t,o),a;if(n){let[c,l]=Ho(r[0],r[1]);a=c*l}else{let[c,l]=Ga(r[0],r[1]);a=c*l}let i=K8(e,s);return a*i}function q8(r,t){switch(r){case Ge.PACKED_2X2_FLOAT32:return mb(t);case Ge.PACKED_2X2_FLOAT16:return fb(t);case Ge.UNPACKED_FLOAT32:return lb(t);case Ge.UNPACKED_FLOAT16:return ub(t);case Ge.PACKED_4X1_UNSIGNED_BYTE:return pb(t);default:throw new Error(`Unknown physical texture type ${r}`)}}function X8(r){return O().getBool("WEBGL_RENDER_FLOAT32_ENABLED")?r?Ge.PACKED_2X2_FLOAT32:Ge.UNPACKED_FLOAT32:r?Ge.PACKED_2X2_FLOAT16:Ge.UNPACKED_FLOAT16}function VR(r,t){if(r===Ze.UPLOAD)return Ge.PACKED_2X2_FLOAT32;if(r===Ze.RENDER||r==null)return X8(t);if(r===Ze.DOWNLOAD||r===Ze.PIXELS)return Ge.PACKED_4X1_UNSIGNED_BYTE;throw new Error(`Unknown logical texture type ${r}`)}function zR(r,t,e){return`${r[0]}_${r[1]}_${t}_${e}`}var Md,GR=h(()=>{I();db();ao();Md=class{constructor(t){this.gpgpu=t,this.numUsedTextures=0,this.numFreeTextures=0,this._numBytesAllocated=0,this._numBytesFree=0,this.freeTextures={},this.usedTextures={},this.logEnabled=!1}acquireTexture(t,e,o){let n=VR(e,o),s=zR(t,n,o);s in this.freeTextures||(this.freeTextures[s]=[]),s in this.usedTextures||(this.usedTextures[s]=[]);let a=BR(t,n,this.gpgpu.gl,this.gpgpu.textureConfig,o);if(this.freeTextures[s].length>0){this.numFreeTextures--,this.numUsedTextures++,this._numBytesFree-=a,this.log();let c=this.freeTextures[s].pop();return this.usedTextures[s].push(c),c}let i;return n===Ge.PACKED_2X2_FLOAT32?i=this.gpgpu.createPackedMatrixTexture(t[0],t[1]):n===Ge.PACKED_2X2_FLOAT16?i=this.gpgpu.createFloat16PackedMatrixTexture(t[0],t[1]):n===Ge.UNPACKED_FLOAT32?i=this.gpgpu.createFloat32MatrixTexture(t[0],t[1]):n===Ge.UNPACKED_FLOAT16?i=this.gpgpu.createFloat16MatrixTexture(t[0],t[1]):n===Ge.PACKED_4X1_UNSIGNED_BYTE&&(i=this.gpgpu.createUnsignedBytesMatrixTexture(t[0],t[1])),this.usedTextures[s].push(i),this.numUsedTextures++,this._numBytesAllocated+=a,this.log(),i}releaseTexture(t,e,o,n){if(this.freeTextures==null)return;let s=VR(o,n),a=zR(e,s,n);a in this.freeTextures||(this.freeTextures[a]=[]);let i=BR(e,s,this.gpgpu.gl,this.gpgpu.textureConfig,n),c=O().getNumber("WEBGL_DELETE_TEXTURE_THRESHOLD");c!==-1&&this._numBytesAllocated>c?(this.gpgpu.deleteMatrixTexture(t.texture),this._numBytesAllocated-=i):(this.freeTextures[a].push(t),this.numFreeTextures++,this._numBytesFree+=i),this.numUsedTextures--;let l=this.usedTextures[a],u=l&&l.indexOf(t);if(u==null||u<0)throw new Error("Cannot release a texture that was never provided by this texture manager");l[u]=l[l.length-1],l.pop(),this.log()}log(){if(!this.logEnabled)return;let t=this.numFreeTextures+this.numUsedTextures;console.log("Free/Used",`${this.numFreeTextures} / ${this.numUsedTextures}`,`(${t})`);let e=this._numBytesFree/this._numBytesAllocated;console.log(`Bytes allocated: ${this._numBytesAllocated}`),console.log(`Bytes unused: ${this._numBytesFree} (${Math.round(100*e)}%)`)}get numBytesAllocated(){return this._numBytesAllocated}get numBytesFree(){return this._numBytesFree}getNumUsedTextures(){return this.numUsedTextures}getNumFreeTextures(){return this.numFreeTextures}dispose(){if(this.freeTextures!=null){for(let t in this.freeTextures)this.freeTextures[t].forEach(e=>{this.gpgpu.deleteMatrixTexture(e.texture)});for(let t in this.usedTextures)this.usedTextures[t].forEach(e=>{this.gpgpu.deleteMatrixTexture(e.texture)});this.freeTextures=null,this.usedTextures=null,this.numUsedTextures=0,this.numFreeTextures=0,this._numBytesAllocated=0,this._numBytesFree=0}}}});var We,Se,WR,D0,UR,HR,KR,jo,qR,Je=h(()=>{Oe();We=class{constructor(t,e){this.variableNames=["A"],this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length),this.userCode=`
      float unaryOperation(float x) {
        ${e}
      }

      void main() {
        float x = getAAtOutCoords();
        float y = unaryOperation(x);

        setOutput(y);
      }
    `}},Se="if (isnan(x)) return x;",WR="return x;",D0="return abs(x);",UR="return (x >= 0.0) ? x : (exp(x) - 1.0);",HR=Se+`
  return (x < 0.0) ? 0.0 : x;
`,KR=Se+`
  return (x < 0.0) ? 0.0 : min(6.0, x);
`,jo="return x;",qR="return 1.0 / (1.0 + exp(-1.0 * x));"});var jR,YR,ZR,QR,JR,wr,Qa=h(()=>{Oe();jR="return x;",YR=`
  vec4 result;

  result.r = (x.r >= 0.0) ? x.r : (exp(x.r) - 1.0);
  result.g = (x.g >= 0.0) ? x.g : (exp(x.g) - 1.0);
  result.b = (x.b >= 0.0) ? x.b : (exp(x.b) - 1.0);
  result.a = (x.a >= 0.0) ? x.a : (exp(x.a) - 1.0);

  return result;
`,ZR=`
  vec4 result = x * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,QR=`
  vec4 result = min(x, vec4(6.)) * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,JR="return 1.0 / (1.0 + exp(-1.0 * x));",wr=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length),this.userCode=`
      vec4 unaryOperation(vec4 x) {
        ${e}
      }

      void main() {
        vec4 x = getAAtOutCoords();
        vec4 y = unaryOperation(x);

        setOutput(y);
      }
    `}}});var Bd,tA=h(()=>{Oe();No();de();Bd=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!1,this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length);let e=t.length,o=he("rc",e),n=St(e),s=LR(e,o),a=o.slice(-2),i=e<=1?"rc":`vec2(${a.join(",")})`;this.userCode=`
      void main() {
        ${n} rc = getOutputCoords();
        vec4 packedInput = getA(${s});

        setOutput(getChannel(packedInput, ${i}));
      }
    `}}});function J8(r){return r in Vd||(Vd[r]={}),Vd[r]}function rY(){return O().global.screen==null?1024:O().global.screen.height*O().global.screen.width*window.devicePixelRatio*eY/1024/1024}function oY(r,t){if(t==="float32"||t==="complex64")return r;if(t==="int32"||t==="bool"){let e=t==="int32"?new Int32Array(r.length):new Uint8Array(r.length);for(let o=0;o<e.length;++o)e[o]=Math.round(r[o]);return e}else throw new Error(`Unknown dtype ${t}`)}var Y8,Z8,Q8,Vd,tY,eY,pp,eA=h(()=>{k2();I();Zf();L2();M2();B2();V2();z2();G2();s$();Oe();Oe();Nt();MR();_0();ao();ao();GR();Je();Je();Qa();tA();Fr();Y8=Ye.whereImpl,Z8=1e-7,Q8=1e-4,Vd={};tY=O().getNumber("CPU_HANDOFF_SIZE_THRESHOLD"),eY=600;pp=class r extends Qo{nextDataId(){return r.nextDataId++}constructor(t){if(super(),this.pendingRead=new WeakMap,this.pendingDisposal=new WeakSet,this.dataRefCount=new WeakMap,this.numBytesInGPU=0,this.uploadWaitMs=0,this.downloadWaitMs=0,this.lastGlFlushTime=0,this.warnedAboutMemory=!1,this.pendingDeletes=0,this.disposed=!1,!O().getBool("HAS_WEBGL"))throw new Error("WebGL is not supported on this device");let e;if(t!=null){if(t instanceof Il)e=t;else{let o=Dr(O().getNumber("WEBGL_VERSION"),t);e=new Il(o)}this.binaryCache={},this.gpgpuCreatedLocally=!1}else{let o=Dr(O().getNumber("WEBGL_VERSION"));e=new Il(o),this.binaryCache=J8(O().getNumber("WEBGL_VERSION")),this.gpgpuCreatedLocally=!0}this.gpgpu=e,this.canvas=this.gpgpu.gl.canvas,this.textureManager=new Md(this.gpgpu),this.numMBBeforeWarning=rY(),this.texData=new ps(this,ro())}numDataIds(){return this.texData.numDataIds()-this.pendingDeletes}writeTexture(t,e,o,n,s,a){let i=this.makeTensorInfo(e,o),c=this.texData.get(i.dataId);c.isPacked=!1,c.texture={texture:t,texShape:[n,s]},c.texShape=[n,s];let l=op(e),u=new np(l,!1,a),p=this.runWebGLProgram(u,[i],o,[[n,s]]);return p.shape=e,c.texture=null,this.disposeIntermediateTensorInfo(i),p.dataId}write(t,e,o){if((O().getBool("WEBGL_CHECK_NUMERICAL_PROBLEMS")||O().getBool("DEBUG"))&&this.checkNumericalProblems(t),o==="complex64"&&t!=null)throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");let n={id:this.nextDataId()};return this.texData.set(n,{shape:e,dtype:o,values:t,usage:Ze.UPLOAD,refCount:1}),n}refCount(t){return this.texData.has(t)?this.texData.get(t).refCount:0}incRef(t){let e=this.texData.get(t);e.refCount++}decRef(t){if(this.texData.has(t)){let e=this.texData.get(t);e.refCount--}}move(t,e,o,n,s){if(O().getBool("DEBUG")&&this.checkNumericalProblems(e),n==="complex64")throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");this.texData.set(t,{shape:o,dtype:n,values:e,usage:Ze.UPLOAD,refCount:s})}disposeIntermediateTensorInfo(t){this.disposeData(t.dataId)}readSync(t){let e=this.texData.get(t),{values:o,dtype:n,complexTensorInfos:s,slice:a,shape:i,isPacked:c}=e;if(a!=null){let m;c?m=new wr(i,jo):m=new We(i,jo);let f=this.runWebGLProgram(m,[{dataId:t,shape:i,dtype:n}],n),d=this.readSync(f.dataId);return this.disposeIntermediateTensorInfo(f),d}if(o!=null)return this.convertAndCacheOnCPU(t);if(n==="string")return o;let l=this.activeTimers!=null,u;l&&(u=b.now());let p;if(n==="complex64"){let m=this.readSync(s.real.dataId),f=this.readSync(s.imag.dataId);p=k.mergeRealAndImagArrays(m,f)}else p=this.getValuesFromTexture(t);return l&&(this.downloadWaitMs+=b.now()-u),this.convertAndCacheOnCPU(t,p)}async read(t){if(this.pendingRead.has(t)){let d=this.pendingRead.get(t);return new Promise(x=>d.push(x))}let e=this.texData.get(t),{values:o,shape:n,slice:s,dtype:a,complexTensorInfos:i,isPacked:c}=e;if(s!=null){let d;c?d=new wr(n,jo):d=new We(n,jo);let x=this.runWebGLProgram(d,[{dataId:t,shape:n,dtype:a}],a),g=this.read(x.dataId);return this.disposeIntermediateTensorInfo(x),g}if(o!=null)return this.convertAndCacheOnCPU(t);if(O().getBool("DEBUG")&&!O().getBool("WEBGL_DOWNLOAD_FLOAT_ENABLED")&&O().getNumber("WEBGL_VERSION")===2)throw new Error("tensor.data() with WEBGL_DOWNLOAD_FLOAT_ENABLED=false and WEBGL_VERSION=2 not yet supported.");let l=null,u;if(a!=="complex64"&&O().get("WEBGL_BUFFER_SUPPORTED")){u=this.decode(t);let d=this.texData.get(u.dataId);l=this.gpgpu.createBufferFromTexture(d.texture.texture,...Ju(n))}this.pendingRead.set(t,[]),a!=="complex64"&&await this.gpgpu.createAndWaitForFence();let p;if(a==="complex64"){let d=await Promise.all([this.read(i.real.dataId),this.read(i.imag.dataId)]),x=d[0],g=d[1];p=k.mergeRealAndImagArrays(x,g)}else if(l==null)p=this.getValuesFromTexture(t);else{let d=b.sizeFromShape(n);p=this.gpgpu.downloadFloat32MatrixFromBuffer(l,d)}if(u!=null&&this.disposeIntermediateTensorInfo(u),l!=null){let d=this.gpgpu.gl;ct(d,()=>d.deleteBuffer(l))}let m=this.convertAndCacheOnCPU(t,p),f=this.pendingRead.get(t);return this.pendingRead.delete(t),f.forEach(d=>d(m)),this.pendingDisposal.has(t)&&(this.pendingDisposal.delete(t),this.disposeData(t)&&ro().removeDataId(t,this),this.pendingDeletes--),m}readToGPU(t,e={}){let o=this.texData.get(t),{values:n,shape:s,slice:a,dtype:i,isPacked:c,texture:l}=o;if(i==="complex64")throw new Error("Does not support reading texture for complex64 dtype.");if(a!=null){let f;c?f=new wr(s,jo):f=new We(s,jo);let d=this.runWebGLProgram(f,[{dataId:t,shape:s,dtype:i}],i),x=this.readToGPU(d,e);return this.disposeIntermediateTensorInfo(d),x}if(l==null)throw n!=null?new Error("Data is not on GPU but on CPU."):new Error("There is no data on GPU or CPU.");let u=this.decode(t,e.customTexShape),p=ro().makeTensorFromTensorInfo(u),m=this.texData.get(u.dataId);return Object.assign({tensorRef:p},m.texture)}bufferSync(t){let e=this.readSync(t.dataId);if(t.dtype==="string")try{let o=e.map(n=>b.decodeString(n));return ut(t.shape,t.dtype,o)}catch{throw new Error("Failed to decode encoded string bytes into utf-8")}return ut(t.shape,t.dtype,e)}checkNumericalProblems(t){if(t!=null)for(let e=0;e<t.length;e++){let o=t[e];if(!i2(o))throw O().getBool("WEBGL_RENDER_FLOAT32_CAPABLE")?Error(`The value ${o} cannot be represented with your current settings. Consider enabling float32 rendering: 'tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);'`):Error(`The value ${o} cannot be represented on this device.`)}}getValuesFromTexture(t){let{shape:e,dtype:o,isPacked:n}=this.texData.get(t),s=b.sizeFromShape(e);if(O().getBool("WEBGL_DOWNLOAD_FLOAT_ENABLED")){let m=this.decode(t),f=this.texData.get(m.dataId),d=this.gpgpu.downloadMatrixFromPackedTexture(f.texture.texture,...Ju(e)).subarray(0,s);return this.disposeIntermediateTensorInfo(m),d}let a=O().getBool("WEBGL_PACK")&&n===!0,i=a?op(e):e,c=a?new id(i):new ad(i),l=this.runWebGLProgram(c,[{shape:i,dtype:o,dataId:t}],"float32"),u=this.texData.get(l.dataId),p=this.gpgpu.downloadByteEncodedFloatMatrixFromOutputTexture(u.texture.texture,u.texShape[0],u.texShape[1]).subarray(0,s);return this.disposeIntermediateTensorInfo(l),p}timerAvailable(){return O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0}time(t){let e=this.activeTimers,o=[],n=!1;this.programTimersStack==null?(this.programTimersStack=o,n=!0):this.activeTimers.push(o),this.activeTimers=o,t();let s=b.flatten(this.activeTimers.map(c=>c.query)).filter(c=>c!=null),a=b.flatten(this.activeTimers.map(c=>c.name)).filter(c=>c!=null);this.activeTimers=e,n&&(this.programTimersStack=null);let i={uploadWaitMs:this.uploadWaitMs,downloadWaitMs:this.downloadWaitMs,kernelMs:null,wallMs:null};return(async()=>{if(O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0){let c=await Promise.all(s);i.kernelMs=b.sum(c),i.getExtraProfileInfo=()=>c.map((l,u)=>({name:a[u],ms:l})).map(l=>`${l.name}: ${l.ms}`).join(", ")}else i.kernelMs={error:"WebGL query timers are not supported in this environment."};return this.uploadWaitMs=0,this.downloadWaitMs=0,i})()}memory(){return{unreliable:!1,numBytesInGPU:this.numBytesInGPU,numBytesInGPUAllocated:this.textureManager.numBytesAllocated,numBytesInGPUFree:this.textureManager.numBytesFree}}startTimer(){return O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0?this.gpgpu.beginQuery():{startMs:b.now(),endMs:null}}endTimer(t){return O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0?(this.gpgpu.endQuery(),t):(t.endMs=b.now(),t)}async getQueryTime(t){if(O().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0)return this.gpgpu.waitForQueryAndGetTime(t);let e=t;return e.endMs-e.startMs}disposeData(t,e=!1){if(this.pendingDisposal.has(t))return!1;if(!this.texData.has(t))return!0;if(e?this.texData.get(t).refCount=0:this.texData.get(t).refCount--,!e&&this.texData.get(t).refCount>0)return!1;if(this.pendingRead.has(t))return this.pendingDisposal.add(t),this.pendingDeletes++,!1;this.releaseGPUData(t);let{complexTensorInfos:o}=this.texData.get(t);return o!=null&&(this.disposeData(o.real.dataId,e),this.disposeData(o.imag.dataId,e)),this.texData.delete(t),!0}releaseGPUData(t){let{texture:e,dtype:o,texShape:n,usage:s,isPacked:a,slice:i}=this.texData.get(t),c=i&&i.origDataId||t,l=this.dataRefCount.get(c);l>1?this.dataRefCount.set(c,l-1):(this.dataRefCount.delete(c),e!=null&&(this.numBytesInGPU-=this.computeBytes(n,o),this.textureManager.releaseTexture(e,n,s,a)));let u=this.texData.get(t);u.texture=null,u.texShape=null,u.isPacked=!1,u.slice=null}getTexture(t){return this.uploadToGPU(t),this.texData.get(t).texture.texture}getDataInfo(t){return this.texData.get(t)}shouldExecuteOnCPU(t,e=tY){return O().getBool("WEBGL_CPU_FORWARD")&&t.every(o=>this.texData.get(o.dataId).texture==null&&b.sizeFromShape(o.shape)<e)}getGPGPUContext(){return this.gpgpu}where(t){k.warn("tf.where() in webgl locks the UI thread. Call tf.whereAsync() instead");let e=t.dataSync();return Y8(t.shape,e)}packedUnaryOp(t,e,o){let n=new wr(t.shape,e),s=this.compileAndRun(n,[t],o);return ro().makeTensorFromTensorInfo(s)}abs(t){if(this.shouldExecuteOnCPU([t])&&t.dtype!=="complex64"){let n=Od(this.texData.get(t.dataId).values);return this.makeOutput(t.shape,t.dtype,n)}if(O().getBool("WEBGL_PACK_UNARY_OPERATIONS"))return this.packedUnaryOp(t,D0,t.dtype);let e=new We(t.shape,D0),o=this.compileAndRun(e,[t]);return ro().makeTensorFromTensorInfo(o)}makeTensorInfo(t,e,o){let n;if(e==="string"&&o!=null&&o.length>0&&b.isString(o[0])){let s=o.map(a=>b.encodeString(a));n=this.write(s,t,e)}else n=this.write(o,t,e);return this.texData.get(n).usage=null,{dataId:n,shape:t,dtype:e}}makeOutput(t,e,o){return ro().makeTensorFromTensorInfo(this.makeTensorInfo(t,e,o),this)}unpackTensor(t){let e=new Bd(t.shape);return this.runWebGLProgram(e,[t],t.dtype)}packTensor(t){let e=new Ld(t.shape);return this.runWebGLProgram(e,[t],t.dtype,null,!0)}packedReshape(t,e){let o=[Qn(t.shape),...Jn(t.shape)],n={dtype:t.dtype,shape:o,dataId:t.dataId},s=[Qn(e),...Jn(e)],a=new _l(s,o),i=!0,c=[o],l=this.runWebGLProgram(a,[n],t.dtype,c,i);return{dataId:l.dataId,shape:e,dtype:l.dtype}}decode(t,e){let o=this.texData.get(t),{isPacked:n,shape:s,dtype:a}=o;if(e!=null){let m=b.sizeFromShape(s),f=e[0]*e[1]*4;b.assert(m<=f,()=>"customTexShape is too small. Row * Column * 4 should be equal or larger than the size of the tensor data.")}let i=op(s),c;n?c=new sd(i):c=new nd(i);let l=!0,u=[e!=null?e:Ju(i)],p=this.runWebGLProgram(c,[{shape:i,dtype:a,dataId:t}],a,u,l,e);return{dtype:a,shape:s,dataId:p.dataId}}runWebGLProgram(t,e,o,n,s=!1,a){let i=this.makeTensorInfo(t.outputShape,o),c=this.texData.get(i.dataId);if(t.packedOutput&&(c.isPacked=!0),t.outPackingScheme===Zn.DENSE){let y=a!=null?a:Ju(t.outputShape);c.texShape=y.map(v=>v*2)}if(t.outTexUsage!=null&&(c.usage=t.outTexUsage),b.sizeFromShape(i.shape)===0)return c.values=b.getTypedArrayFromDType(i.dtype,0),i;let l=[],u=e.map(y=>{if(y.dtype==="complex64")throw new Error("GPGPUProgram does not support complex64 input. For complex64 dtypes, please separate the program into real and imaginary parts.");let v=this.texData.get(y.dataId);if(v.texture==null){if(!t.packedInputs&&b.sizeFromShape(y.shape)<=O().getNumber("WEBGL_SIZE_UPLOAD_UNIFORM"))return{shape:y.shape,texData:null,isUniform:!0,uniformValues:v.values};t.packedInputs&&(v.isPacked=!0,v.shape=y.shape)}if(this.uploadToGPU(y.dataId),!!v.isPacked!=!!t.packedInputs)y=v.isPacked?this.unpackTensor(y):this.packTensor(y),l.push(y),v=this.texData.get(y.dataId);else if(v.isPacked&&!Wa(v.shape,y.shape)){let N=y,S=y.shape;y.shape=v.shape,y=this.packedReshape(y,S),l.push(y),v=this.texData.get(y.dataId),N.shape=S}return{shape:y.shape,texData:v,isUniform:!1}});this.uploadToGPU(i.dataId);let p={shape:i.shape,texData:c,isUniform:!1},m=P2(t,u,p),f=this.getAndSaveBinary(m,()=>F2(this.gpgpu,t,u,p)),d=this.activeTimers!=null,x;d&&(x=this.startTimer()),O().get("ENGINE_COMPILE_ONLY")||O2(this.gpgpu,f,u,p,n),l.forEach(y=>this.disposeIntermediateTensorInfo(y)),d&&(x=this.endTimer(x),this.activeTimers.push({name:t.constructor.name,query:this.getQueryTime(x)}));let g=O().getNumber("WEBGL_FLUSH_THRESHOLD");if(g>0){let y=b.now();y-this.lastGlFlushTime>g&&(this.gpgpu.gl.flush(),this.lastGlFlushTime=y)}if(!O().getBool("WEBGL_LAZILY_UNPACK")&&c.isPacked&&s===!1){let y=this.unpackTensor(i);return this.disposeIntermediateTensorInfo(i),y}return i}compileAndRun(t,e,o,n,s=!1){return o=o||e[0].dtype,this.runWebGLProgram(t,e,o,n,s)}getAndSaveBinary(t,e){return t in this.binaryCache||(this.binaryCache[t]=e()),this.binaryCache[t]}getTextureManager(){return this.textureManager}dispose(){this.disposed||(O().getBool("IS_TEST")||Object.keys(this.binaryCache).forEach(e=>{this.gpgpu.deleteProgram(this.binaryCache[e].webGLProgram),delete this.binaryCache[e]}),this.textureManager.dispose(),this.canvas!=null&&typeof HTMLCanvasElement!="undefined"&&this.canvas instanceof HTMLCanvasElement?this.canvas.remove():this.canvas=null,this.gpgpuCreatedLocally&&(this.gpgpu.program=null,this.gpgpu.dispose()),this.disposed=!0)}floatPrecision(){return this.floatPrecisionValue==null&&(this.floatPrecisionValue=Tt(()=>{if(!O().get("WEBGL_RENDER_FLOAT32_ENABLED")){let t=O().getBool("DEBUG");O().set("DEBUG",!1);let e=this.abs(bt(1e-8)).dataSync()[0];if(O().set("DEBUG",t),e>0)return 32}return 16})),this.floatPrecisionValue}epsilon(){return this.floatPrecision()===32?Z8:Q8}uploadToGPU(t){let e=this.texData.get(t),{shape:o,dtype:n,values:s,texture:a,usage:i,isPacked:c}=e;if(a!=null)return;let l=this.activeTimers!=null,u;l&&(u=b.now());let p=e.texShape;if(p==null&&(p=v2(o,c),e.texShape=p),s!=null){let m=op(o),f,d=p[1],x=p[0],g=s instanceof Uint8Array||s instanceof Uint8ClampedArray;(c||!g)&&([d,x]=Ho(p[0],p[1])),c?f=new cd(m,g):f=new np(m,g);let y=g?[x,d]:p,v=this.makeTensorInfo(y,n),N=this.texData.get(v.dataId);g?N.usage=Ze.PIXELS:N.usage=Ze.UPLOAD,N.texShape=y,this.gpgpu.uploadDenseMatrixToTexture(this.getTexture(v.dataId),d,x,s);let S=[[x,d]],A=this.runWebGLProgram(f,[v],n,S,!0),_=this.texData.get(A.dataId);e.texShape=_.texShape,e.isPacked=_.isPacked,e.usage=_.usage,O().get("ENGINE_COMPILE_ONLY")?this.disposeData(A.dataId):(e.texture=_.texture,e.values=null,this.texData.delete(A.dataId)),this.disposeIntermediateTensorInfo(v),l&&(this.uploadWaitMs+=b.now()-u)}else{let m=this.acquireTexture(p,i,n,c);e.texture=m}}convertAndCacheOnCPU(t,e){let o=this.texData.get(t),{dtype:n}=o;return e!=null&&(o.values=oY(e,n)),o.values}acquireTexture(t,e,o,n){if(this.numBytesInGPU+=this.computeBytes(t,o),!this.warnedAboutMemory&&this.numBytesInGPU>this.numMBBeforeWarning*1024*1024){let s=(this.numBytesInGPU/1024/1024).toFixed(2);this.warnedAboutMemory=!0,console.warn(`High memory usage in GPU: ${s} MB, most likely due to a memory leak`)}return this.textureManager.acquireTexture(t,e,n)}computeBytes(t,e){return t[0]*t[1]*b.bytesPerElement(e)}checkCompileCompletion(){for(let[,t]of Object.entries(this.binaryCache))this.checkCompletion_(t)}async checkCompileCompletionAsync(){let t=[];if(this.gpgpu.parallelCompilationExtension){for(let[,e]of Object.entries(this.binaryCache))t.push(this.checkCompletionAsync_(e));return Promise.all(t)}else{for(let[,e]of Object.entries(this.binaryCache)){let o=new Promise(n=>{try{this.checkCompletion_(e),n(!0)}catch(s){throw s}});t.push(o)}return Promise.all(t)}}async checkCompletionAsync_(t){return this.gpgpu.gl.getProgramParameter(t.webGLProgram,this.gpgpu.parallelCompilationExtension.COMPLETION_STATUS_KHR)?this.checkCompletion_(t):(await Yy(),this.checkCompletionAsync_(t))}checkCompletion_(t){if(this.gpgpu.gl.getProgramParameter(t.webGLProgram,this.gpgpu.gl.LINK_STATUS)===!1)throw console.log(this.gpgpu.gl.getProgramInfoLog(t.webGLProgram)),this.gpgpu.gl.getShaderParameter(t.fragmentShader,this.gpgpu.gl.COMPILE_STATUS)===!1?(nb(t.source,this.gpgpu.gl.getShaderInfoLog(t.fragmentShader)),new Error("Failed to compile fragment shader.")):new Error("Failed to link vertex and fragment shaders.");return!0}getUniformLocations(){for(let t of Object.values(this.binaryCache)){this.gpgpu.buildVao(t.webGLProgram);let{variablesLocations:e,customUniformLocations:o,infLoc:n,nanLoc:s,outShapeLocation:a,outShapeStridesLocation:i,outTexShapeLocation:c}=cb(this.gpgpu,t.program,t.webGLProgram);t.variablesLocations=e,t.customUniformLocations=o,t.infLoc=n,t.nanLoc=s,t.outShapeLocation=a,t.outShapeStridesLocation=i,t.outTexShapeLocation=c}}createTensorFromGPUData(t,e,o){t.channels=t.channels||"RGBA";let{texture:n,height:s,width:a,channels:i}=t,c=ro().backend;if(!c.gpgpu.gl.isTexture(n))throw new Error("The texture is invalid. Also, please make sure the texture and the TFJS WebGL backend are using the same canvas. If you want to use your own custom canvas, you have to create and use the custom TFJS WebGL backend created from the canvas through 'new tf.MathBackendWebGL(customCanvas)'.");let l=c.writeTexture(n,e,o,s,a,i);return ro().makeTensorFromDataId(l,e,o,c)}};pp.nextDataId=0});var rA=h(()=>{I();});var oA=h(()=>{I();eA();rA();Fn.isBrowser()&&mm("webgl",()=>new pp,2)});var Dl,Cr,Yo=h(()=>{I();Oe();Dl=`
  if (isnan(a)) return a;
  if (isnan(b)) return b;
`,Cr=class{constructor(t,e,o){this.variableNames=["A","B"],this.outputShape=k.assertAndGetBroadcastShape(e,o),this.enableShapeUniforms=qt(this.outputShape.length),this.userCode=`
      float binaryOperation(float a, float b) {
        ${t}
      }

      void main() {
        float a = getAAtOutCoords();
        float b = getBAtOutCoords();
        setOutput(binaryOperation(a, b));
      }
    `}}});var Lr,Pr,Mr=h(()=>{I();Oe();No();de();Lr=`
  result.r = isNaN.r ? NAN : result.r;
  result.g = isNaN.g ? NAN : result.g;
  result.b = isNaN.b ? NAN : result.b;
  result.a = isNaN.a ? NAN : result.a;
`,Pr=class{constructor(t,e,o,n=!1){this.variableNames=["A","B"],this.supportsBroadcasting=!0,this.packedInputs=!0,this.packedOutput=!0,this.outputShape=k.assertAndGetBroadcastShape(e,o);let s=this.outputShape.length;this.enableShapeUniforms=qt(s);let a="";if(n)if(s===0||b.sizeFromShape(this.outputShape)===1)a=`
          result.y = 0.;
          result.z = 0.;
          result.w = 0.;
        `;else if(a=`
          ${St(s)} coords = getOutputCoords();
        `,s===1)this.enableShapeUniforms?a+=`
            result.y = (coords + 1) >= outShape ? 0. : result.y;
            result.z = 0.;
            result.w = 0.;
          `:a+=`
            result.y = (coords + 1) >= ${this.outputShape[0]} ? 0. : result.y;
            result.z = 0.;
            result.w = 0.;
          `;else{let c=he("coords",s);this.enableShapeUniforms?a+=`
            bool nextRowOutOfBounds =
              (${c[s-2]} + 1) >= outShape[${s} - 2];
            bool nextColOutOfBounds =
              (${c[s-1]} + 1) >= outShape[${s} - 1];
            result.y = nextColOutOfBounds ? 0. : result.y;
            result.z = nextRowOutOfBounds ? 0. : result.z;
            result.w = nextColOutOfBounds || nextRowOutOfBounds ? 0. : result.w;
          `:a+=`
            bool nextRowOutOfBounds =
              (${c[s-2]} + 1) >= ${this.outputShape[s-2]};
            bool nextColOutOfBounds =
              (${c[s-1]} + 1) >= ${this.outputShape[s-1]};
            result.y = nextColOutOfBounds ? 0. : result.y;
            result.z = nextRowOutOfBounds ? 0. : result.z;
            result.w = nextColOutOfBounds || nextRowOutOfBounds ? 0. : result.w;
          `}this.userCode=`
      vec4 binaryOperation(vec4 a, vec4 b) {
        ${t}
      }

      void main() {
        vec4 a = getAAtOutCoords();
        vec4 b = getBAtOutCoords();

        vec4 result = binaryOperation(a, b);
        ${a}

        setOutput(result);
      }
    `}}});function ge(r){let{inputs:t,backend:e}=r,{x:o}=t;return e.incRef(o.dataId),{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}var nA,Qr=h(()=>{I();nA={kernelName:$n,backendName:"webgl",kernelFunc:ge}});function Sr(r){let{inputs:t,backend:e}=r,{real:o,imag:n}=t,s=e.makeTensorInfo(o.shape,"complex64"),a=e.texData.get(s.dataId),i=ge({inputs:{x:o},backend:e}),c=ge({inputs:{x:n},backend:e});return a.complexTensorInfos={real:i,imag:c},s}var sA,bn=h(()=>{I();Qr();sA={kernelName:Ci,backendName:"webgl",kernelFunc:Sr}});function nY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{alpha:s}=o,a=e.makeTensorInfo([],"float32",b.createScalarValue(s,"float32")),i=O().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new Pr(O0,n.shape,a.shape):new Cr(F0,n.shape,a.shape),c=e.runWebGLProgram(i,[n,a],"float32");return e.disposeIntermediateTensorInfo(a),c}var F0,O0,aA,P0=h(()=>{I();Yo();Mr();F0="return (a < 0.) ? b * a : a;",O0=`
  vec4 aLessThanZero = vec4(lessThan(a, vec4(0.)));
  return (aLessThanZero * (b * a)) + ((vec4(1.0) - aLessThanZero) * a);
`;aA={kernelName:ji,backendName:"webgl",kernelFunc:nY}});function sY(r){let{inputs:t,backend:e}=r,{x:o,alpha:n}=t,s=O().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new Pr(M0,o.shape,n.shape):new Cr(L0,o.shape,n.shape);return e.runWebGLProgram(s,[o,n],"float32")}var L0,M0,iA,B0=h(()=>{I();Yo();Mr();L0="return (a < 0.) ? b * a : a;",M0=`
  vec4 aLessThanZero = vec4(lessThan(a, vec4(0.)));
  return (aLessThanZero * (b * a)) + ((vec4(1.0) - aLessThanZero) * a);
`;iA={kernelName:uc,backendName:"webgl",kernelFunc:sY}});function pt({opSnippet:r,packedOpSnippet:t,cpuKernelImpl:e,dtype:o}){return({inputs:n,backend:s})=>{let{x:a}=n,i=s,c=o||a.dtype;if(i.shouldExecuteOnCPU([a])&&e!=null){let p=i.texData.get(a.dataId),m=e(p.values,c);return i.makeTensorInfo(a.shape,c,m)}let l=O().getBool("WEBGL_PACK_UNARY_OPERATIONS")&&t!=null,u;return l?u=new wr(a.shape,t):u=new We(a.shape,r),i.runWebGLProgram(u,[a],c)}}function Wt({opSnippet:r,packedOpSnippet:t,checkOutOfBounds:e=!1,supportsComplex:o=!1,cpuKernelImpl:n,dtype:s}){return({inputs:a,backend:i})=>{let{a:c,b:l}=a,u=i;if(o&&c.dtype==="complex64"){let d=u.texData.get(c.dataId),x=u.texData.get(l.dataId),[g,y]=[[d.complexTensorInfos.real,x.complexTensorInfos.real],[d.complexTensorInfos.imag,x.complexTensorInfos.imag]].map(N=>{let[S,R]=N,A={dataId:S.dataId,dtype:S.dtype,shape:c.shape},_={dataId:R.dataId,dtype:R.dtype,shape:l.shape},D=new Cr(r,c.shape,l.shape);return u.runWebGLProgram(D,[A,_],be(S.dtype,R.dtype))}),v=Sr({inputs:{real:g,imag:y},backend:u});return u.disposeIntermediateTensorInfo(g),u.disposeIntermediateTensorInfo(y),v}let p=s||be(c.dtype,l.dtype);if((c.dtype==="string"||l.dtype==="string"||u.shouldExecuteOnCPU([c,l]))&&n!=null){let d=u.texData.get(c.dataId).values,x=u.texData.get(l.dataId).values,g=c.dtype==="string"?k.fromUint8ToStringArray(d):d,y=c.dtype==="string"?k.fromUint8ToStringArray(x):x,[v,N]=n(c.shape,l.shape,g,y,p),S=u.makeTensorInfo(N,p),R=u.texData.get(S.dataId);return R.values=v,S}let m=O().getBool("WEBGL_PACK_BINARY_OPERATIONS")&&t!=null,f;return m?f=new Pr(t,c.shape,l.shape,e):f=new Cr(r,c.shape,l.shape),u.runWebGLProgram(f,[c,l],p)}}function vn(r,t=!1){if(r==="linear")return t?jR:WR;if(r==="relu")return t?ZR:HR;if(r==="elu")return t?YR:UR;if(r==="relu6")return t?QR:KR;if(r==="prelu")return t?M0:L0;if(r==="leakyrelu")return t?O0:F0;if(r==="sigmoid")return t?JR:qR;throw new Error(`Activation ${r} has not been implemented for the WebGL backend.`)}var mo,wt=h(()=>{I();Yo();Mr();bn();P0();B0();Je();Je();Qa();Qa();mo="if (isnan(x)) return x;"});var Fl,V0=h(()=>{Oe();Fl=class{constructor(t,e,o,n=!1,s=!1,a=!1,i=null,c=!1,l=!1){this.variableNames=["matrixA","matrixB"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=o,this.enableShapeUniforms=qt(this.outputShape.length);let u=n?t[1]:t[2],p=Math.ceil(u/2),m=n?"i * 2, rc.y":"rc.y, i * 2",f=s?"rc.z, i * 2":"i * 2, rc.z",d=n?["a.xxyy","a.zzww"]:["a.xxzz","a.yyww"],x=s?["b.xzxz","b.ywyw"]:["b.xyxy","b.zwzw"],g="",y="";i&&(c?g=`vec4 activation(vec4 a) {
          vec4 b = getPreluActivationWeightsAtOutCoords();
          ${i}
        }`:l?g=`vec4 activation(vec4 a) {
          vec4 b = getLeakyreluAlphaAtOutCoords();
          ${i}
        }`:g=`vec4 activation(vec4 x) {
          ${i}
        }`,y="result = activation(result);");let v=a?"result += getBiasAtOutCoords();":"";a&&this.variableNames.push("bias"),c&&this.variableNames.push("preluActivationWeights"),l&&this.variableNames.push("leakyreluAlpha");let N="rc.x",S="rc.x";t[0]<e[0]?N=`imod(rc.x, ${t[0]})`:e[0]<t[0]&&(S=`imod(rc.x, ${e[0]})`),this.userCode=`
      ${g}
      // Don't use uniform for sharedDimensionPacked for performance.
      const float sharedDimension = ${p}.0;

      vec4 dot2x2ARowBCol(ivec3 rc) {
        vec4 result = vec4(0);
        int batchA = ${N};
        int batchB = ${S};
        for (int i = 0; i < ${p}; i++) {
          vec4 a = getMatrixA(batchA, ${m});
          vec4 b = getMatrixB(batchB, ${f});

          // These swizzled products need to be separately added.
          // See: https://github.com/tensorflow/tfjs/issues/1735
          result += (${d[0]} * ${x[0]});
          result += (${d[1]} * ${x[1]});
        }
        return result;
      }

      void main() {
        ivec3 rc = getOutputCoords();
        vec4 result = dot2x2ARowBCol(rc);

        ${v}

        ${y}

        setOutput(result);
      }
    `}}});var z0,mp,G0=h(()=>{I();z0={REAL:"return areal * breal - aimag * bimag;",IMAG:"return areal * bimag + aimag * breal;"},mp=class{constructor(t,e,o){this.variableNames=["AReal","AImag","BReal","BImag"],this.outputShape=k.assertAndGetBroadcastShape(e,o),this.userCode=`
      float binaryOpComplex(
          float areal, float aimag, float breal, float bimag) {
        ${t}
      }

      void main() {
        float areal = getARealAtOutCoords();
        float aimag = getAImagAtOutCoords();
        float breal = getBRealAtOutCoords();
        float bimag = getBImagAtOutCoords();
        setOutput(binaryOpComplex(areal, aimag, breal, bimag));
      }
    `}}});function fp(r){let{inputs:t,backend:e}=r,{a:o,b:n}=t,s=k.upcastType(o.dtype,n.dtype);if(o.dtype==="complex64"){let i=e.texData.get(o.dataId),c=e.texData.get(n.dataId),l=new mp(z0.REAL,o.shape,n.shape),u=new mp(z0.IMAG,o.shape,n.shape),p=[{dataId:i.complexTensorInfos.real.dataId,dtype:i.complexTensorInfos.real.dtype,shape:o.shape},{dataId:i.complexTensorInfos.imag.dataId,dtype:i.complexTensorInfos.imag.dtype,shape:o.shape},{dataId:c.complexTensorInfos.real.dataId,dtype:c.complexTensorInfos.real.dtype,shape:n.shape},{dataId:c.complexTensorInfos.imag.dataId,dtype:c.complexTensorInfos.imag.dtype,shape:n.shape}],m=e.runWebGLProgram(l,p,"float32"),f=e.runWebGLProgram(u,p,"float32"),d=Sr({inputs:{real:m,imag:f},backend:e});return e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),d}if(e.shouldExecuteOnCPU([o,n])){let i=e.texData.get(o.dataId),c=e.texData.get(n.dataId),[l,u]=fR(o.shape,n.shape,i.values,c.values,s),p=e.makeTensorInfo(u,s),m=e.texData.get(p.dataId);return m.values=l,p}let a;return O().getBool("WEBGL_PACK_BINARY_OPERATIONS")?a=new Pr(cA,o.shape,n.shape):a=new Cr(cA,o.shape,n.shape),e.runWebGLProgram(a,[o,n],s)}var cA,lA,zd=h(()=>{I();G0();G0();Yo();Mr();Nt();bn();cA="return a * b;";lA={kernelName:Us,backendName:"webgl",kernelFunc:fp}});function uA(r,t,e){let o=[Qn(r.shape),...Jn(r.shape)],n={dtype:r.dtype,shape:o,dataId:r.dataId},s=[Qn(t),...Jn(t)],a=new _l(s,o),i=!0,c=[o],l=e.runWebGLProgram(a,[n],r.dtype,c,i);return{dataId:l.dataId,shape:t,dtype:l.dtype}}var pA=h(()=>{_0();Fr();});function J(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{shape:s}=o,a=e,i=b.sizeFromShape(n.shape),c=b.inferFromImplicitShape(s,i),l=b.sizeFromShape(c);b.assert(i===l,()=>`The new shape (${c}) has ${l} elements and the old shape (${n.shape}) has ${i} elements. The new shape and old shape must have the same number of elements.`);let u=a.texData.get(n.dataId);return u.isPacked&&!Wa(n.shape,c)&&!(u.texture!==null&&Wa(u.shape,c))?uA(n,c,a):(a.incRef(n.dataId),{dataId:n.dataId,shape:c,dtype:n.dtype})}var mA,Xt=h(()=>{I();pA();Fr();mA={kernelName:xc,backendName:"webgl",kernelFunc:J}});var dp,fA=h(()=>{I();dp=class{constructor(t,e){this.variableNames=["x"];let{windowSize:o,batchSize:n,inSize:s,outSize:a}=t;this.outputShape=[n,a];let i=Math.floor(o/4)*4,c=o%4,l="sumValue += dot(values, ones);";if(e!=null){let p=1/e;l=`sumValue += dot(values * ${b.isInt(p)?p.toPrecision(2):p}, ones);`}let u="";s%o>0&&(u=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return 0.0;
        }
      `),this.userCode=`
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float getValue(int batch, int inIdx) {
        ${u}
        return getX(batch, inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${o};

        float sumValue = 0.0;

        for (int i = 0; i < ${i}; i += 4) {
          int inIdx = inOffset + i;
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          ${l}
        }

        int inIdx = inOffset + ${i};
        if (${c===1}) {
          vec4 values = vec4(getValue(batch, inIdx), 0.0, 0.0, 0.0);

          ${l}
        } else if (${c===2}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1), 0.0, 0.0);

          ${l}
        } else if (${c===3}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2), 0.0);

          ${l}
        }
        setOutput(sumValue);
      }
    `}}});var Gd,dA=h(()=>{Gd=class{constructor(t,e){this.variableNames=["x"];let{windowSize:o,batchSize:n,inSize:s,outSize:a}=t;this.outputShape=[n,a];let i="0.0",c="";e==="prod"?i="1.0":e==="min"?(i="1.0 / 1e-20",c="min"):e==="max"&&(i="-1.0 / 1e-20",c="max");let l=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="sum"?l="sumValue":e==="prod"?l="prodValue":e==="all"?l="allValue":e==="any"&&(l="anyValue");let u=Math.floor(o/4)*4,p=o%4,m=`
      if (${e==="sum"}) {
        sumValue += dot(values, ones);
      } else if (${e==="prod"}) {
        vec2 tmp = vec2(values[0], values[1]) * vec2(values[2], values[3]);
        prodValue *= tmp[0] * tmp[1];
      } else {
        minMaxValue = ${c}(values, minMaxValue);
        if (${e==="min"} || ${e==="max"}) {
          minMaxValue = ${c}(values, minMaxValue);
          bvec4 isNaN = isnan(values);
          if (isNaN.r || isNaN.g || isNaN.b || isNaN.a) {
            minMaxValue = vec4(NAN);
          }
        }
      }
    `,f="vec4";e==="all"?(i="1.0",m=`
        bool reducedAllValue = all(values);
        float floatedReducedAllValue = float(reducedAllValue);
        allValue = float(allValue >= 1.0 && floatedReducedAllValue >= 1.0);
      `,f="bvec4"):e==="any"&&(i="0.0",m=`
        bool reducedAnyValue = any(values);
        float floatedReducedAnyValue = float(reducedAnyValue);
        anyValue = float(anyValue >= 1.0 || floatedReducedAnyValue >= 1.0);
      `,f="bvec4");let d="";s%o>0&&(d=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return initializationValue;
        }
      `),this.userCode=`
      const float initializationValue = ${i};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float getValue(int batch, int inIdx) {
        ${d}
        return getX(batch, inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${o};

        vec4 minMaxValue = vec4(${i});
        float prodValue = 1.0;
        float sumValue = 0.0;
        float allValue = 1.0;
        float anyValue = 0.0;

        for (int i = 0; i < ${u}; i += 4) {
          int inIdx = inOffset + i;
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          ${m}
        }

        int inIdx = inOffset + ${u};
        if (${p===1}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            initializationValue,
            initializationValue,
            initializationValue
          );

          ${m}
        } else if (${p===2}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            initializationValue,
            initializationValue
          );

          ${m}
        } else if (${p===3}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            initializationValue
          );

          ${m}
        }
        setOutput(${l});
      }
    `}}});function iY(r){let t=[];for(;t.length===0||t[t.length-1].outSize!==1;){let e=t.length?t[t.length-1].outSize:r[1],o=k.computeOptimalWindowSize(e);t.push({inSize:e,windowSize:o,outSize:Math.ceil(e/o)})}return t}function Br(r,t,e,o){let n=iY(r.shape),s=r;for(let a=0;a<n.length;a++){let{inSize:i,windowSize:c,outSize:l}=n[a],u,p;e==="mean"?u=a===0?new dp({windowSize:c,inSize:i,batchSize:r.shape[0],outSize:l},i):new dp({windowSize:c,inSize:i,batchSize:r.shape[0],outSize:l}):u=new Gd({windowSize:c,inSize:i,batchSize:r.shape[0],outSize:l},e),p=s,s=o.runWebGLProgram(u,[s],t),p.dataId!==r.dataId&&o.disposeIntermediateTensorInfo(p)}return s}var es=h(()=>{I();fA();dA();});function cY(r){let t=r.length;if(t>6)throw Error(`Transpose for rank ${t} is not yet supported`);let e=["resRC.x","resRC.y","resRC.z","resRC.w","resRC.u","resRC.v"],o=new Array(t);for(let n=0;n<r.length;n++)o[r[n]]=e[n];return o.join()}var Wd,hA=h(()=>{de();Wd=class{constructor(t,e){this.variableNames=["A"];let o=new Array(t.length);for(let a=0;a<o.length;a++)o[a]=t[e[a]];this.outputShape=o,this.rank=o.length;let n=St(this.rank),s=cY(e);this.userCode=`
    void main() {
      ${n} resRC = getOutputCoords();
      setOutput(getA(${s}));
    }
    `}}});var Ud,gA=h(()=>{No();de();Ud=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0;let o=new Array(t.length);for(let u=0;u<o.length;u++)o[u]=t[e[u]];if(this.outputShape=o,this.rank=o.length,this.rank>6)throw Error(`Packed transpose for rank ${this.rank} is not yet supported.`);let n=St(this.rank),s=A0("rc",this.rank),a=new Array(this.rank);for(let u=0;u<e.length;u++)a[e[u]]=s[u];let i=`vec2(${a.slice(-2).join()})`,c=`++${s[this.rank-1]} < ${o[this.rank-1]}`,l=`getChannel(getA(${a.join()}), ${i})`;this.userCode=`
    void main() {
      ${n} rc = getOutputCoords();
      vec4 result = vec4(0.);
      result[0] = ${l};
      if(${c}) {
        result[1] = ${l};
      }
      --${s[this.rank-1]};
      if(++${s[this.rank-2]} < ${o[this.rank-2]}) {
        result[2] = ${l};
        if(${c}) {
          result[3] = ${l};
        }
      }
      setOutput(result);
    }
    `}}});function rs(r,t,e){let o=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new Ud(r.shape,t):new Wd(r.shape,t);return e.runWebGLProgram(o,[r],r.dtype)}var Ol=h(()=>{I();Nt();hA();gA();});function xA(r,t,e,o){let n=t,s=r.shape.length,a=b.parseAxisParam(n,r.shape),i=a,c=k.getAxesPermutation(i,s),l=c!=null,u=r;l&&(u=rs(r,c,o),i=k.getInnerMostAxes(i.length,s)),k.assertAxesAreInnerMostDims("sum",i,s);let[p,m]=k.computeOutAndReduceShapes(u.shape,i),f=p;e&&(f=k.expandShapeToKeepDim(p,a));let d=b.sizeFromShape(m),g=b.sizeFromShape(r.shape)/d,y=J({inputs:{x:u},attrs:{shape:[g,d]},backend:o}),v=ha(r.dtype),N=Br(y,v,"sum",o),S=J({inputs:{x:N},attrs:{shape:f},backend:o});return o.disposeIntermediateTensorInfo(y),o.disposeIntermediateTensorInfo(N),l&&o.disposeIntermediateTensorInfo(u),S}var yA=h(()=>{I();es();Xt();Ol();});function Ja(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;return xA(n,s,a,e)}var bA,hp=h(()=>{I();yA();bA={kernelName:"Sum",backendName:"webgl",kernelFunc:Ja}});function re(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{perm:s}=o,a=e,i=n.shape.length,c=new Array(i);for(let u=0;u<c.length;u++)c[u]=n.shape[s[u]];let l;if(a.shouldExecuteOnCPU([n])){let p=a.texData.get(n.dataId).values,m=Za(p,n.shape,n.dtype,s,c);l=a.makeTensorInfo(c,n.dtype);let f=a.texData.get(l.dataId);f.values=m}else l=rs(n,s,a);return l}var vA,Vr=h(()=>{I();Ol();Ol();vA={kernelName:An,backendName:"webgl",kernelFunc:re}});function ti({a:r,b:t,transposeA:e,transposeB:o,backend:n,bias:s=null,preluActivationWeights:a=null,leakyreluAlpha:i=0,activation:c=null}){let l=r.shape.length,u=t.shape.length,p=e?r.shape[l-2]:r.shape[l-1],m=o?t.shape[u-1]:t.shape[u-2],f=e?r.shape[l-1]:r.shape[l-2],d=o?t.shape[u-2]:t.shape[u-1],x=r.shape.slice(0,-2),g=t.shape.slice(0,-2),y=b.sizeFromShape(x),v=b.sizeFromShape(g),S=Mo.assertAndGetBroadcastShape(r.shape.slice(0,-2),t.shape.slice(0,-2)).concat([f,d]);b.assert(p===m,()=>`Error in matMul: inner shapes (${p}) and (${m}) of Tensors with shapes ${r.shape} and ${t.shape} and transposeA=${e} and transposeB=${o} must match.`);let R=e?[y,p,f]:[y,f,p],A=o?[v,d,m]:[v,m,d],_=J({inputs:{x:r},backend:n,attrs:{shape:R}}),D=J({inputs:{x:t},backend:n,attrs:{shape:A}}),L=[_,D],M=Math.max(y,v),V=e?_.shape[1]:_.shape[2],W=s!=null,G=a!=null,K=c==="leakyrelu",U=c!=null?vn(c,!0):null,j=W||G||K||U!=null,Z;if((f===1||d===1)&&V>W0&&j===!1){let Q=_,rt=D;e&&(Q=re({inputs:{x:_},backend:n,attrs:{perm:[0,2,1]}}),L.push(Q)),o&&(rt=re({inputs:{x:D},backend:n,attrs:{perm:[0,2,1]}}),L.push(rt));let et=d!==1,st=d===1,ot=Q;et&&(ot=J({inputs:{x:Q},backend:n,attrs:{shape:[M,V,1]}}),L.push(ot));let at=d===1?2:1,nt=rt;st&&(nt=J({inputs:{x:rt},backend:n,attrs:{shape:[M,1,V]}}),L.push(nt));let lt=fp({inputs:{a:ot,b:nt},backend:n});Z=Ja({inputs:{x:lt},backend:n,attrs:{axis:at,keepDims:!0}}),L.push(lt)}else{let Q=be(r.dtype,t.dtype),rt=new Fl(R,A,[M,f,d],e,o,W,U,G,K),et=[_,D];if(s!=null&&et.push(s),G&&et.push(a),K){let st=n.makeTensorInfo([],"float32",b.createScalarValue(i,"float32"));et.push(st),L.push(st)}Z=n.runWebGLProgram(rt,et,Q)}let q=J({inputs:{x:Z},backend:n,attrs:{shape:S}});L.push(Z);for(let Q of L)n.disposeIntermediateTensorInfo(Q);return q}var W0,Hd=h(()=>{I();wt();V0();zd();Xt();hp();Vr();W0=1e3});function lY(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s,bias:a,preluActivationWeights:i}=t,{transposeA:c,transposeB:l,activation:u,leakyreluAlpha:p}=o;return ti({a:n,b:s,transposeA:c,transposeB:l,backend:e,bias:a,preluActivationWeights:i,leakyreluAlpha:p,activation:u})}var wA,CA=h(()=>{I();Hd();wA={kernelName:ia,backendName:"webgl",kernelFunc:lY}});function uY(r){let{inputs:t,backend:e}=r,{x:o}=t;if(e.shouldExecuteOnCPU([o])&&o.dtype!=="complex64"){let s=e.texData.get(o.dataId),a=Od(s.values);return e.makeTensorInfo(o.shape,o.dtype,a)}let n;return O().getBool("WEBGL_PACK_UNARY_OPERATIONS")?n=new wr(o.shape,SA):n=new We(o.shape,SA),e.runWebGLProgram(n,[o],o.dtype)}var SA,NA,TA=h(()=>{I();Nt();Je();Qa();SA="return abs(x);";NA={kernelName:"Abs",backendName:"webgl",kernelFunc:uY}});var pY,mY,IA,kA=h(()=>{I();wt();Je();pY=Se+`
  if (abs(x) > 1.) {
    return NAN;
  }
  return acos(x);
`,mY=pt({opSnippet:pY}),IA={kernelName:hs,backendName:"webgl",kernelFunc:mY}});var fY,dY,EA,$A=h(()=>{I();wt();Je();fY=Se+`
  if (x < 1.0) return NAN;
return log(x + sqrt(x * x - 1.0));`,dY=pt({opSnippet:fY}),EA={kernelName:gs,backendName:"webgl",kernelFunc:dY}});var RA,hY,AA,_A=h(()=>{I();wt();Nt();RA="return a + b;",hY=Wt({opSnippet:RA,packedOpSnippet:RA,supportsComplex:!0,cpuKernelImpl:K$}),AA={kernelName:"Add",backendName:"webgl",kernelFunc:hY}});var Kd,DA=h(()=>{Kd=class{constructor(t,e){this.outputShape=[],this.outputShape=t,this.variableNames=e.map((s,a)=>`T${a}`);let o=[];this.variableNames.forEach(s=>{o.push(`float v${s} = get${s}AtOutCoords();`)});let n=this.variableNames.map(s=>`v${s}`).join(" + ");this.userCode=`
      void main() {
        ${o.join(`
        `)}

        float result = ${n};
        setOutput(result);
      }
    `}}});var qd,FA=h(()=>{qd=class{constructor(t,e){this.outputShape=[],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.variableNames=e.map((s,a)=>`T${a}`);let o=[];this.variableNames.forEach(s=>{o.push(`vec4 v${s} = get${s}AtOutCoords();`)});let n=this.variableNames.map(s=>`v${s}`).join(" + ");this.userCode=`
      void main() {
        ${o.join(`
        `)}

        vec4 result = ${n};
        setOutput(result);
      }
    `}}});function Xd(r){let{inputs:t,backend:e}=r,o=t;if(o.length===1)return ge({inputs:{x:o[0]},backend:e});if(o.length>O().getNumber("WEBGL_MAX_TEXTURES_IN_SHADER")){let c=Math.floor(o.length/2),l=Xd({inputs:o.slice(0,c),backend:e}),u=Xd({inputs:o.slice(c),backend:e});return Xd({inputs:[l,u],backend:e})}let n=o.map(c=>c.dtype).reduce((c,l)=>be(c,l)),s=o.map(c=>c.shape),i=O().getBool("WEBGL_PACK")?new qd(o[0].shape,s):new Kd(o[0].shape,s);return e.runWebGLProgram(i,o,n)}var OA,PA=h(()=>{I();DA();FA();Qr();OA={kernelName:fi,backendName:"webgl",kernelFunc:Xd}});function gY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o,i=n.shape.length,c=b.parseAxisParam(s,n.shape),l=c,u=k.getAxesPermutation(l,i),p=n;u!=null&&(p=re({inputs:{x:n},backend:e,attrs:{perm:u}}),l=k.getInnerMostAxes(l.length,i)),k.assertAxesAreInnerMostDims("all",l,i);let[m,f]=k.computeOutAndReduceShapes(p.shape,l),d=b.sizeFromShape(f),x=J({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=Br(x,x.dtype,"all",e),y;if(a){let v=k.expandShapeToKeepDim(m,c);y=J({inputs:{x:g},backend:e,attrs:{shape:v}})}else y=J({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),y}var LA,MA=h(()=>{I();es();Xt();Vr();LA={kernelName:"All",backendName:"webgl",kernelFunc:gY}});function xY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o,i=n.shape.length,c=b.parseAxisParam(s,n.shape),l=c,u=k.getAxesPermutation(l,i),p=n;u!=null&&(p=re({inputs:{x:n},backend:e,attrs:{perm:u}}),l=k.getInnerMostAxes(l.length,i)),k.assertAxesAreInnerMostDims("any",l,i);let[m,f]=k.computeOutAndReduceShapes(p.shape,l),d=b.sizeFromShape(f),x=J({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=Br(x,x.dtype,"any",e),y;if(a){let v=k.expandShapeToKeepDim(m,c);y=J({inputs:{x:g},backend:e,attrs:{shape:v}})}else y=J({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),y}var BA,VA=h(()=>{I();es();Xt();Vr();BA={kernelName:"Any",backendName:"webgl",kernelFunc:xY}});var jd,zA=h(()=>{jd=class{constructor(t,e,o){this.variableNames=["A"];let{windowSize:n,batchSize:s,outSize:a}=t;o||this.variableNames.push("bestIndicesA"),this.outputShape=[s,a];let i=e==="max"?">":"<",c=o?"inOffset + i;":"round(getBestIndicesA(batch, inOffset + i));";this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${n};

        int bestIndex = inOffset;
        float bestValue = getA(batch, bestIndex);

        for (int i = 0; i < ${n}; i++) {
          int inIdx = ${c};
          float candidate = getA(batch, inIdx);
          if (candidate ${i} bestValue) {
            bestValue = candidate;
            bestIndex = inIdx;
          }
        }
        setOutput(float(bestIndex));
      }
    `}}});var Yd,GA=h(()=>{I();No();de();Yd=class{constructor(t,e,o,n){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,b.assert(t.length>2,()=>`Packed arg${o.charAt(0).toUpperCase()+o.slice(1)} supports only inputs with rank above 2.`);let s=t[t.length-1],a=Math.ceil(s/e);this.outputShape=t.slice(0,-1),a>1&&this.outputShape.push(a),n||this.variableNames.push("bestIndicesA");let i=this.outputShape,c=i.length,l=St(c),u=he("coords",c),p,m;if(a===1){m=c+1;let D=St(m);p=`
        ${D} sourceLocR = ${D}(${u.join()}, 0);
        ++${u[c-1]};
        ${D} sourceLocG = ${D}(${u.join()}, 0);
        ++${u[c-2]};
        ${D} sourceLocA = ${D}(${u.join()}, 0);
        --${u[c-1]};
        ${D} sourceLocB = ${D}(${u.join()}, 0);
        --${u[c-2]};`}else m=c,p=`
        ${l} sourceLocR = coords;
        ++${u[c-1]};
        ${l} sourceLocG = coords;
        ++${u[c-2]};
        ${l} sourceLocA = coords;
        --${u[c-1]};
        ${l} sourceLocB = coords;
        --${u[c-2]};`;let f=["x","y","z","w","u","v"].slice(0,m),d="."+f[m-1],x=f.map(D=>"int "+D),g=he("sourceLocR",m-1).concat("inIdx.r"),y=he("sourceLocG",m-1).concat("inIdx.g"),v=he("sourceLocB",m-1).concat("inIdx.b"),N=he("sourceLocA",m-1).concat("inIdx.a"),S=o==="max"?"greaterThan":"lessThan",R=n?"":`
          inIdx = round(vec4(getBestIndicesAChannel(${g.join()}),
                             getBestIndicesAChannel(${y.join()}),
                             getBestIndicesAChannel(${v.join()}),
                             getBestIndicesAChannel(${N.join()})));`,A=`vec4(
            getAChannel(${g.join()}),
            hasNextCol ? getAChannel(${y.join()}) : 0.,
            hasNextRow ? getAChannel(${v.join()}) : 0.,
            hasNextRow && hasNextCol ? getAChannel(${N.join()}) : 0.)`,_=n?"":`
      float getBestIndicesAChannel(${x.join()}) {
        return getChannel(getBestIndicesA(${f.join()}),
                                          vec2(${f.slice(-2).join()}));
      }`;this.userCode=`
      float getAChannel(${x.join()}) {
        return getChannel(getA(${f.join()}),
                               vec2(${f.slice(-2).join()}));
      }
      ${_}
      void main() {
        ${l} coords = getOutputCoords();
        bool hasNextCol = ${u[c-1]} < ${i[c-1]-1};
        bool hasNextRow = ${u[c-2]} < ${i[c-2]-1};
        ${p}
        ivec4 srcIdx = ivec4(sourceLocR${d}, sourceLocG${d},
          sourceLocB${d}, sourceLocA${d}) * ${e};
        ivec4 inIdx = srcIdx;
        vec4 bestIndex = vec4(inIdx);
        vec4 bestValue = ${A};

        for (int i = 0; i < ${e}; i++) {
          inIdx = srcIdx;
          ${R}
          vec4 candidate = ${A};
          bvec4 nan = isnan(candidate);
          bvec4 replace = bvec4(
            vec4(${S}(candidate, bestValue)) * (vec4(1.0) - vec4(nan)));

          bestValue = vec4(replace.x  ? candidate.x : bestValue.x,
                           replace.y  ? candidate.y : bestValue.y,
                           replace.z  ? candidate.z : bestValue.z,
                           replace.w  ? candidate.w : bestValue.w);
          bestIndex = mix(bestIndex, vec4(inIdx), vec4(replace));
          srcIdx++;
        }
        setOutput(bestIndex);
      }
    `}}});function WA(r,t,e,o=null){let n=t.shape[0],s=t.shape[1];o!=null&&(n=o.shape[0],s=o.shape[1]);let a=k.computeOptimalWindowSize(s),i={windowSize:a,inSize:s,batchSize:n,outSize:Math.ceil(s/a)},c=new jd(i,e,o==null),l=[t];o!=null&&l.push(o);let u=r.runWebGLProgram(c,l,"int32");if(u.shape[1]===1)return u;let p=WA(r,t,e,u);return r.disposeIntermediateTensorInfo(u),p}function UA(r,t,e,o=null){let n=o!=null?o.shape:t.shape,s=n[n.length-1],a=k.computeOptimalWindowSize(s),i=new Yd(n,a,e,o==null),c=o==null?[t]:[t,o],l=r.runWebGLProgram(i,c,"int32");if(l.shape.length===t.shape.length){let u=UA(r,t,e,l);return r.disposeIntermediateTensorInfo(l),u}return l}function Zd(r,t,e,o){let n=[e];if(k.assertAxesAreInnerMostDims("arg"+o.charAt(0).toUpperCase()+o.slice(1),n,t.shape.length),!O().getBool("WEBGL_PACK_REDUCE")||t.shape.length<=2){let s=[],a=r.texData.get(t.dataId),i=a!==null&&a.isPacked,c=t;i&&(c=r.unpackTensor(t),s.push(c));let[l,u]=k.computeOutAndReduceShapes(c.shape,n),p=b.sizeFromShape(u),m=J({inputs:{x:c},backend:r,attrs:{shape:[-1,p]}});s.push(m);let f=WA(r,m,o);s.push(f);let d=J({inputs:{x:f},backend:r,attrs:{shape:l}});return s.forEach(x=>r.disposeIntermediateTensorInfo(x)),d}return UA(r,t,o)}var U0=h(()=>{I();zA();GA();Xt();});function yY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o,a=b.parseAxisParam(s,n.shape),i=k.getAxesPermutation(a,n.shape.length),c=n,l=[];i!=null&&(c=re({inputs:{x:n},backend:e,attrs:{perm:i}}),l.push(c),a=k.getInnerMostAxes(a.length,c.shape.length)),k.assertAxesAreInnerMostDims("argMax",[a[0]],c.shape.length);let u=Zd(e,c,a[0],"max");return l.forEach(p=>e.disposeIntermediateTensorInfo(p)),u}var HA,KA=h(()=>{I();U0();Vr();HA={kernelName:di,backendName:"webgl",kernelFunc:yY}});function bY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o,a=b.parseAxisParam(s,n.shape),i=k.getAxesPermutation(a,n.shape.length),c=n,l=[];i!=null&&(c=re({inputs:{x:n},backend:e,attrs:{perm:i}}),l.push(c),a=k.getInnerMostAxes(a.length,c.shape.length)),k.assertAxesAreInnerMostDims("argMin",[a[0]],c.shape.length);let u=Zd(e,c,a[0],"min");return l.forEach(p=>e.disposeIntermediateTensorInfo(p)),u}var qA,XA=h(()=>{I();U0();Vr();qA={kernelName:hi,backendName:"webgl",kernelFunc:bY}});var vY,wY,jA,YA=h(()=>{I();wt();Je();vY=Se+`
  if (abs(x) > 1.) {
    return NAN;
  }
  return asin(x);
`,wY=pt({opSnippet:vY}),jA={kernelName:xs,backendName:"webgl",kernelFunc:wY}});var CY,SY,ZA,QA=h(()=>{I();wt();Je();CY=Se+"return log(x + sqrt(x * x + 1.0));",SY=pt({opSnippet:CY}),ZA={kernelName:ys,backendName:"webgl",kernelFunc:SY}});var NY,TY,JA,t_=h(()=>{I();wt();Je();NY=Se+`
  return atan(x);
`,TY=pt({opSnippet:NY}),JA={kernelName:bs,backendName:"webgl",kernelFunc:TY}});var IY,kY,EY,e_,r_=h(()=>{I();Yo();Mr();wt();IY=Dl+`
  return atan(a, b);
`,kY=`
  vec4 result = atan(a, b);
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+Lr+`
  return result;
`,EY=Wt({opSnippet:IY,packedOpSnippet:kY}),e_={kernelName:ws,backendName:"webgl",kernelFunc:EY}});var $Y,RY,o_,n_=h(()=>{I();wt();Je();$Y=Se+`
  if ((x < -1.0) || (x > 1.0)) return NAN;
return (log(1.0 + x) - log(1.0 - x)) / 2.0;`,RY=pt({opSnippet:$Y}),o_={kernelName:vs,backendName:"webgl",kernelFunc:RY}});var To,os,ns=h(()=>{To=class{constructor(t,e,o,n=!1,s=!1){if(this.variableNames=["x"],e==="avg"&&o)throw new Error("Cannot compute positions for average pool.");let a=t.filterWidth,i=t.strideHeight,c=t.strideWidth,l=t.dilationHeight,u=t.dilationWidth,p=t.effectiveFilterHeight,m=t.effectiveFilterWidth,f=t.padInfo.top,d=t.padInfo.left;this.outputShape=t.outShape;let x=e==="avg",g=`((batch  * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + d`,y=`(xR * ${t.inWidth} + xC) * ${t.inChannels} + d`,v="0.0";if(x||(v="-1.0 / 1e-20"),o){this.userCode=`
        const ivec2 strides = ivec2(${i}, ${c});
        const ivec2 pads = ivec2(${f}, ${d});

        void main() {
          ivec4 coords = getOutputCoords();
          int batch = coords[0];
          int d = coords[3];

          ivec2 xRCCorner = coords.yz * strides - pads;
          int xRCorner = xRCCorner.x;
          int xCCorner = xRCCorner.y;

          // max/min x(?, ?, d) to get y(yR, yC, d).
          // ? = to be determined
          float minMaxValue = 0.0;
          float minMaxValueFound = 0.0;
          int minMaxPosition = 0;
          float avgValue = 0.0;

          for (int wR = 0; wR < ${p};
              wR += ${l}) {
            int xR = xRCorner + wR;

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${m};
                wC += ${u}) {
              int xC = xCCorner + wC;

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              float value = getX(batch, xR, xC, d);

              // If a min / max value has already been found, use it. If not,
              // use the current value.
              float currMinMaxValue = mix(
                  value, minMaxValue, minMaxValueFound);
              if (value >= currMinMaxValue) {
                minMaxValue = value;
                minMaxValueFound = 1.0;
                minMaxPosition = ${n?s?g:y:`wR * ${m} + wC`};
              }
            }
          }
          setOutput(float(minMaxPosition));
        }
      `;return}let N="max",S=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="avg"&&(S="avgValue / max(count, 1.0)");let R=Math.floor(a/4)*4,A=a%4,_=`
      if (${x}) {
        avgValue += dot(values, ones);
      } else {
        minMaxValue = ${N}(values, minMaxValue);
      }
    `;this.userCode=`
      const ivec2 strides = ivec2(${i}, ${c});
      const ivec2 pads = ivec2(${f}, ${d});
      const float initializationValue = ${v};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float count = 0.0;

      float getValue(int batch, int xR, int xC, int d) {
        if (xC < 0 || xC >= ${t.inWidth}) {
          return initializationValue;
        }
        count += 1.0;
        return getX(batch, xR, xC, d);
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d = coords[3];

        ivec2 xRCCorner = coords.yz * strides - pads;
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // max/min x(?, ?, d) to get y(yR, yC, d).
        // ? = to be determined
        vec4 minMaxValue = vec4(${v});
        float avgValue = 0.0;
        count = 0.0;

        for (int wR = 0; wR < ${p};
            wR += ${l}) {
          int xR = xRCorner + wR;

          if (xR < 0 || xR >= ${t.inHeight}) {
            continue;
          }

          for (int wC = 0; wC < ${R}; wC += 4) {
            int xC = xCCorner + wC * ${u};

            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              getValue(batch, xR, xC + 2 * ${u}, d),
              getValue(batch, xR, xC + 3 * ${u}, d)
            );

            ${_}
          }

          int xC = xCCorner + ${R};
          if (${A===1}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              initializationValue,
              initializationValue,
              initializationValue
            );

            ${_}
          } else if (${A===2}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              initializationValue,
              initializationValue
            );

            ${_}
          } else if (${A===3}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              getValue(batch, xR, xC + 2 * ${u}, d),
              initializationValue
            );

            ${_}
          }
        }
        setOutput(${S});
      }
    `}},os=class{constructor(t,e,o,n=!1,s=!1){if(this.variableNames=["x"],e==="avg"&&o)throw new Error("Cannot compute positions for average pool.");let a=t.filterWidth,i=t.strideDepth,c=t.strideHeight,l=t.strideWidth,u=t.dilationDepth,p=t.dilationHeight,m=t.dilationWidth,f=t.effectiveFilterDepth,d=t.effectiveFilterHeight,x=t.effectiveFilterWidth,g=t.padInfo.front,y=t.padInfo.top,v=t.padInfo.left;this.outputShape=t.outShape;let N=e==="avg",S="0.0";if(N||(S="-1.0 / 1e-20"),o){this.userCode=`
        const ivec3 strides =
            ivec3(${i}, ${c}, ${l});
        const ivec3 pads = ivec3(${g}, ${y}, ${v});

        void main() {
          ivec5 coords = getOutputCoords();
          int batch = coords.x;
          int ch = coords.u;

          ivec3 xCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
          int xDCorner = xCorner.x;
          int xRCorner = xCorner.y;
          int xCCorner = xCorner.z;

          // max/min x(?, ?, ?, ch) to get y(yD, yR, yC, ch).
          // ? = to be determined
          float minMaxValue = 0.0;
          float minMaxValueFound = 0.0;
          int minMaxPosition = 0;

          for (int wD = 0; wD < ${f};
              wD += ${u}) {
            int xD = xDCorner + wD;

            if (xD < 0 || xD >= ${t.inDepth}) {
              continue;
            }

            for (int wR = 0; wR < ${d};
                wR += ${p}) {
              int xR = xRCorner + wR;

              if (xR < 0 || xR >= ${t.inHeight}) {
                continue;
              }

              for (int wC = 0; wC < ${x};
                  wC += ${m}) {
                int xC = xCCorner + wC;

                if (xC < 0 || xC >= ${t.inWidth}) {
                  continue;
                }

                float value = getX(batch, xD, xR, xC, ch);

                // If a min / max value has already been found, use it. If not,
                // use the current value.
                float currMinMaxValue = mix(
                    value, minMaxValue, minMaxValueFound);
                if (value >= currMinMaxValue) {
                  minMaxValue = value;
                  minMaxValueFound = 1.0;
                  minMaxPosition = ${n?s?`(((batch * ${t.inDepth} + xD) * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + ch`:`((xD * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + ch`:`wD * ${d} * ${x} +
                      wR * ${x} + wC`};
                }
              }
            }
          }
          setOutput(float(minMaxPosition));
        }
      `;return}let R="max",A=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="avg"&&(A="avgValue / max(count, 1.0)");let _=Math.floor(a/4)*4,D=a%4,L=`
      if (${N}) {
        avgValue += dot(values, ones);
      } else {
        minMaxValue = ${R}(values, minMaxValue);
      }
    `;this.userCode=`
      const ivec3 strides =
        ivec3(${i}, ${c}, ${l});
      const ivec3 pads = ivec3(${g}, ${y}, ${v});
      const float initializationValue = ${S};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float count = 0.0;

      float getValue(int batch, int xD, int xR, int xC, int ch) {
        if (xC < 0 || xC >= ${t.inWidth}) {
          return initializationValue;
        }
        count += 1.0;
        return getX(batch, xD, xR, xC, ch);
      }

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 xCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
        int xDCorner = xCorner.x;
        int xRCorner = xCorner.y;
        int xCCorner = xCorner.z;

        // max/min x(?, ?, ?, d) to get y(yD, yR, yC, ch).
        // ? = to be determined
        vec4 minMaxValue = vec4(${S});
        float avgValue = 0.0;
        count = 0.0;

        for (int wD = 0; wD < ${f};
            wD += ${u}) {
          int xD = xDCorner + wD;

          if (xD < 0 || xD >= ${t.inDepth}) {
            continue;
          }

          for (int wR = 0; wR < ${d};
            wR += ${p}) {
            int xR = xRCorner + wR;

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${_}; wC += 4) {
              int xC = xCCorner + wC * ${m};

              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                getValue(batch, xD, xR, xC + 2 * ${m}, ch),
                getValue(batch, xD, xR, xC + 3 * ${m}, ch)
              );

              ${L}
            }

            int xC = xCCorner + ${_};
            if (${D===1}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                initializationValue,
                initializationValue,
                initializationValue
              );

              ${L}
            } else if (${D===2}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                initializationValue,
                initializationValue
              );

              ${L}
            } else if (${D===3}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                getValue(batch, xD, xR, xC + 2 * ${m}, ch),
                initializationValue
              );

              ${L}
            }
          }
        }
        setOutput(${A});
      }
    `}}});function AY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;Ko(n,"avgPool");let{filterSize:s,strides:a,pad:i,dimRoundingMode:c}=o,l=1;b.assert(k.eitherStridesOrDilationsAreOne(a,l),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${a} and dilations '${l}'`);let u=k.computePool2DInfo(n.shape,s,a,l,i,c);if(u.filterWidth===1&&u.filterHeight===1&&b.arraysEqual(u.inShape,u.outShape))return ge({inputs:{x:n},backend:e});let p=new To(u,"avg",!1);return e.runWebGLProgram(p,[n],"float32")}var s_,a_=h(()=>{I();ns();Fr();Qr();s_={kernelName:gi,backendName:"webgl",kernelFunc:AY}});function _Y(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:a,pad:i,dimRoundingMode:c,dataFormat:l}=o,u=[1,1,1],p=k.computePool3DInfo(n.shape,s,a,u,i,c,l),m=new os(p,"avg",!1);return e.runWebGLProgram(m,[n],"float32")}var i_,c_=h(()=>{I();ns();i_={kernelName:xi,backendName:"webgl",kernelFunc:_Y}});var Qd,Jd,H0=h(()=>{Qd=class{constructor(t){this.variableNames=["dy"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,a=t.dilationHeight,i=t.dilationWidth,c=t.effectiveFilterHeight,l=t.effectiveFilterWidth,u=c-1-t.padInfo.top,p=l-1-t.padInfo.left,m=1/(e*o);this.userCode=`
      const ivec2 pads = ivec2(${u}, ${p});
      const float avgMultiplier = float(${m});

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];

        ivec2 dyRCCorner = coords.yz - pads;
        int dyRCorner = dyRCCorner.x;
        int dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${c};
            wR += ${a}) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          for (int wC = 0; wC < ${l};
            wC+= ${i}) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            float dyValue = getDy(b, idyR, idyC, d);

            dotProd += dyValue * avgMultiplier;
          }
        }
        setOutput(dotProd);
      }
    `}},Jd=class{constructor(t){this.variableNames=["dy"],this.outputShape=t.inShape;let e=t.filterDepth,o=t.filterHeight,n=t.filterWidth,s=t.strideDepth,a=t.strideHeight,i=t.strideWidth,c=t.dilationDepth,l=t.dilationHeight,u=t.dilationWidth,p=t.effectiveFilterDepth,m=t.effectiveFilterHeight,f=t.effectiveFilterWidth,d=p-1-t.padInfo.front,x=m-1-t.padInfo.top,g=f-1-t.padInfo.left,y=1/(e*o*n);this.userCode=`
      const ivec3 pads = ivec3(${d}, ${x}, ${g});
      const float avgMultiplier = float(${y});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyDCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, d) with pos mask(:, :, :, ch) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int wD = 0; wD < ${p};
            wD += ${c}) {
          float dyD = float(dyDCorner + wD) / ${s}.0;

          if (dyD < 0.0 || dyD >= ${t.outDepth}.0 || fract(dyD) > 0.0) {
            continue;
          }
          int idyD = int(dyD);

          for (int wR = 0; wR < ${m};
              wR += ${l}) {
            float dyR = float(dyRCorner + wR) / ${a}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
                fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            for (int wC = 0; wC < ${f};
                wC += ${u}) {
              float dyC = float(dyCCorner + wC) / ${i}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              float dyValue = getDy(batch, idyD, idyR, idyC, ch);

              dotProd += dyValue * avgMultiplier;
            }
          }
        }
        setOutput(dotProd);
      }
    `}}});function DY(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,a=s,{filterSize:i,strides:c,pad:l,dimRoundingMode:u}=o,p=[1,1,1],m=k.computePool3DInfo(a.shape,i,c,p,l,u),f=new Jd(m);return e.runWebGLProgram(f,[n],a.dtype)}var l_,u_=h(()=>{I();H0();l_={kernelName:Up,backendName:"webgl",kernelFunc:DY}});function FY(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,a=s;Ko([n,s],"avgPoolGrad");let{filterSize:i,strides:c,pad:l}=o,u=k.computePool2DInfo(a.shape,i,c,1,l),p=new Qd(u);return e.runWebGLProgram(p,[n],a.dtype)}var p_,m_=h(()=>{I();H0();Fr();p_={kernelName:Wp,backendName:"webgl",kernelFunc:FY}});function OY(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s}=t,{transposeA:a,transposeB:i}=o;return ti({a:n,b:s,transposeA:a,transposeB:i,backend:e})}var f_,d_=h(()=>{I();Hd();f_={kernelName:yi,backendName:"webgl",kernelFunc:OY}});var th,h_=h(()=>{I();th=class{constructor(t,e,o,n,s,a){this.outputShape=[],this.variableNames=["x","mean","variance"],k.assertAndGetBroadcastShape(t,e),k.assertAndGetBroadcastShape(t,o);let i="0.0";n!=null&&(k.assertAndGetBroadcastShape(t,n),this.variableNames.push("offset"),i="getOffsetAtOutCoords()");let c="1.0";s!=null&&(k.assertAndGetBroadcastShape(t,s),this.variableNames.push("scale"),c="getScaleAtOutCoords()"),this.outputShape=t,this.userCode=`
      void main() {
        float x = getXAtOutCoords();
        float mean = getMeanAtOutCoords();
        float variance = getVarianceAtOutCoords();
        float offset = ${i};
        float scale = ${c};
        float inv = scale * inversesqrt(variance + float(${a}));
        setOutput(dot(vec3(x, -mean, offset), vec3(inv, inv, 1)));
      }
    `}}});var eh,g_=h(()=>{I();eh=class{constructor(t,e,o,n,s,a){this.packedInputs=!0,this.packedOutput=!0,this.variableNames=["x","mean","variance"],k.assertAndGetBroadcastShape(t,e),k.assertAndGetBroadcastShape(t,o);let i="vec4(0.0)";n!=null&&(k.assertAndGetBroadcastShape(t,n),this.variableNames.push("offset"),i="getOffsetAtOutCoords()");let c="vec4(1.0)";s!=null&&(k.assertAndGetBroadcastShape(t,s),this.variableNames.push("scale"),c="getScaleAtOutCoords()"),this.outputShape=t,this.userCode=`
      void main() {
        vec4 offset = ${i};
        vec4 scale = ${c};

        vec4 x = getXAtOutCoords();
        vec4 mean = getMeanAtOutCoords();
        vec4 variance = getVarianceAtOutCoords();

        vec4 inv = scale * inversesqrt(variance + vec4(${a}));

        setOutput((x - mean) * inv + offset);
      }
    `}}});var PY,x_,y_=h(()=>{I();h_();g_();PY=({inputs:r,backend:t,attrs:e})=>{let{x:o,mean:n,variance:s,offset:a,scale:i}=r;b.assert(n.shape.length===s.shape.length,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),b.assert(a==null||n.shape.length===a.shape.length,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),b.assert(i==null||n.shape.length===i.shape.length,()=>"Batch normalization gradient requires mean and scale to have equal ranks.");let{varianceEpsilon:c}=e;c==null&&(c=.001);let l=[o,n,s],u=null;a!=null&&(u=a.shape,l.push(a));let p=null;i!=null&&(p=i.shape,l.push(i));let m=O().getBool("WEBGL_PACK_NORMALIZATION")?new eh(o.shape,n.shape,s.shape,u,p,c):new th(o.shape,n.shape,s.shape,u,p,c);return t.runWebGLProgram(m,l,l[0].dtype)},x_={kernelName:Ui,backendName:"webgl",kernelFunc:PY}});function LY(r){if(r===1)return"sourceLoc";if(r<=6)return K0.slice(0,r).map(t=>"sourceLoc."+t).join(",");throw Error(`Slicing for rank ${r} is not yet supported`)}var rh,K0,b_=h(()=>{de();rh=class{constructor(t){this.variableNames=["source"],this.outputShape=t,this.rank=t.length;let e=St(this.rank);this.customUniforms=[{name:"start",arrayIndex:this.rank,type:"int"}];let o=LY(this.rank),n,s=t.map((a,i)=>`sourceLoc.${K0[i]} = start[${i}] + coords.${K0[i]};`);n=`
        ${e} sourceLoc;
        ${e} coords = getOutputCoords();
        ${s.join(`
`)}
      `,this.userCode=`
      void main() {
        ${n}
        setOutput(getSource(${o}));
      }
    `}},K0=["x","y","z","w","u","v"]});var oh,v_=h(()=>{No();de();oh=class{constructor(t){this.variableNames=["source"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.rank=t.length,this.customUniforms=[{name:"start",arrayIndex:this.rank,type:"int"}];let e=St(this.rank),o=he("coords",this.rank),n=he("sourceLoc",this.rank),s=this.rank===1?"sourceLoc":`vec2(${n.slice(-2).join()})`,a=`getChannel(getSource(${n.join()}), ${s})`,i=`
      result.x = ${a};
      if (++${o[this.rank-1]} < ${t[this.rank-1]}) {
        ++${n[this.rank-1]};
        result.y = ${a};
        --${n[this.rank-1]};
      }
    `,c=this.rank===1?"":`
      --${o[this.rank-1]};
      if (++${o[this.rank-2]} < ${t[this.rank-2]}) {
        ++${n[this.rank-2]};
        result.z = ${a};
        if (++${o[this.rank-1]} < ${t[this.rank-1]}) {
          ++${n[this.rank-1]};
          result.w = ${a};
        }
      }
    `,l=this.rank<=4?`sourceLoc = coords +
            ${e}(${t.map((u,p)=>`start[${p}]`).join()});`:t.map((u,p)=>`${n[p]} = ${o[p]} + start[${p}];`).join(`
`);this.userCode=`
      void main() {
        ${e} coords = getOutputCoords();
        ${e} sourceLoc;
        ${l}
        vec4 result = vec4(0.);
        ${i}
        ${c}
        setOutput(result);
      }
    `}}});function MY(r,t,e,o){let n=o.texData.get(r.dataId),s=o.makeTensorInfo(e,r.dtype),a=o.texData.get(s.dataId);Object.assign(a,n),a.refCount=1,a.shape=e,a.dtype=r.dtype;let i=Fe.computeFlatOffset(t,b.computeStrides(r.shape));n.slice&&(i+=n.slice.flatOffset),a.slice={flatOffset:i,origDataId:n.slice&&n.slice.origDataId||r.dataId};let c=o.dataRefCount.get(a.slice.origDataId)||1;return o.dataRefCount.set(a.slice.origDataId,c+1),s}function Io(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,size:a}=o,[i,c]=Fe.parseSliceParams(n,s,a);if(Fe.assertParamsValid(n,i,c),b.sizeFromShape(c)===0)return e.makeTensorInfo(c,n.dtype,[]);if(e.shouldExecuteOnCPU([n])||n.dtype==="string"){let p=e.texData.get(n.dataId),m=NR(p.values,i,c,n.shape,n.dtype);return e.makeTensorInfo(c,n.dtype,m)}let{isPacked:l}=e.texData.get(n.dataId),u=Fe.isSliceContinous(n.shape,i,c);if(l||!u){let p=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new oh(c):new rh(c),m=[i];return e.runWebGLProgram(p,[n],n.dtype,m)}return e.uploadToGPU(n.dataId),MY(n,i,c,e)}var w_,ei=h(()=>{I();Nt();b_();v_();w_={kernelName:Tc,backendName:"webgl",kernelFunc:Io}});var BY,C_,S_=h(()=>{I();Xt();ei();Vr();BY=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,crops:a}=o;b.assert(n.shape.length<=4,()=>"batchToSpaceND for rank > 4 with a WebGL backend not implemented yet");let i=s.reduce((v,N)=>v*N),c=k.getReshaped(n.shape,s,i),l=k.getPermuted(c.length,s.length),u=k.getReshapedPermuted(n.shape,s,i),p=k.getSliceBeginCoords(a,s.length),m=k.getSliceSize(u,a,s.length),f=[],d=J({inputs:{x:n},backend:e,attrs:{shape:c}}),x=re({inputs:{x:d},backend:e,attrs:{perm:l}}),g=J({inputs:{x},backend:e,attrs:{shape:u}}),y=Io({inputs:{x:g},backend:e,attrs:{begin:p,size:m}});return f.push(d),f.push(x),f.push(g),f.forEach(v=>e.disposeIntermediateTensorInfo(v)),y},C_={kernelName:bi,backendName:"webgl",kernelFunc:BY}});function VY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:a}=o,i=e.readSync(n.dataId),c=e.readSync(s.dataId),l=Fd(i,c,s.dtype,s.shape,a);return e.makeTensorInfo([a],s.dtype,l)}var N_,T_=h(()=>{I();Nt();N_={kernelName:vi,backendName:"webgl",kernelFunc:VY}});function WY(r){let{inputs:t,backend:e}=r,{a:o,b:n}=t,s=O().getBool("WEBGL_PACK_BINARY_OPERATIONS"),a=O().getNumber("WEBGL_VERSION");if(e.shouldExecuteOnCPU([o,n])||a===1){let c=e.texData.get(o.dataId).values,l=e.texData.get(n.dataId).values,[u,p]=X$(o.shape,n.shape,c,l,o.dtype),m=e.makeTensorInfo(p,o.dtype),f=e.texData.get(m.dataId);return f.values=u,m}let i;return s?i=new Pr(zY,o.shape,n.shape,!1):i=new Cr(GY,o.shape,n.shape),e.runWebGLProgram(i,[o,n],o.dtype)}var zY,GY,I_,k_=h(()=>{I();Yo();Mr();Nt();zY=`
  int r = int(a.r) & int(b.r);
  int g = int(a.g) & int(b.g);
  int rb = int(a.b) & int(b.b);
  int ra = int(a.a) & int(b.a);
  return vec4(r, g, rb, ra);
`,GY=`
  return float(int(a.r) & int(b.r));
`;I_={kernelName:Cs,backendName:"webgl",kernelFunc:WY}});function UY(r){let{inputs:t,backend:e}=r,{s0:o,s1:n}=t,s=e.readSync(o.dataId),a=e.readSync(n.dataId),i=k.assertAndGetBroadcastShape(Array.from(s),Array.from(a));return e.makeTensorInfo([i.length],"int32",Int32Array.from(i))}var E_,$_=h(()=>{I();E_={kernelName:wi,backendName:"webgl",kernelFunc:UY}});var HY,q0,R_,X0=h(()=>{I();wt();Nt();HY="return float(a != b);",q0=Wt({opSnippet:HY,cpuKernelImpl:hR,dtype:"bool"}),R_={kernelName:Hs,backendName:"webgl",kernelFunc:q0}});function wn(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.texData.get(o.dataId);return ge({inputs:{x:n.complexTensorInfos.real},backend:e})}var A_,Pl=h(()=>{I();Qr();A_={kernelName:gc,backendName:"webgl",kernelFunc:wn}});function __(r,t){let e=new We(r.shape,KY),o=t.runWebGLProgram(e,[r],"int32");return{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}var KY,D_=h(()=>{Je();KY="return float(int(x));"});function j0(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dtype:s}=o;if(s==="complex64"){if(n.dtype==="complex64")return ge({inputs:{x:n},backend:e});let a=Xr(n.shape),i=j0({inputs:{x:n},backend:e,attrs:{dtype:"float32"}}),c=Sr({inputs:{real:i,imag:a},backend:e});return a.dispose(),e.disposeIntermediateTensorInfo(i),c}if(n.dtype==="complex64"){let a=wn({inputs:{input:n},backend:e}),i=j0({inputs:{x:a},backend:e,attrs:{dtype:s}});return e.disposeIntermediateTensorInfo(a),i}if(!b.hasEncodingLoss(n.dtype,s)){let a=ge({inputs:{x:n},backend:e});return{dataId:a.dataId,shape:a.shape,dtype:s}}if(e.shouldExecuteOnCPU([n])){let a=e.texData.get(n.dataId).values,[i,c,l]=j$(a,n.shape,n.dtype,s);return e.makeTensorInfo(i,c,l)}if(s==="int32")return __(n,e);if(s==="bool"){let a=e.makeTensorInfo([],"bool",b.getTypedArrayFromDType("bool",1)),c=q0({inputs:{a:n,b:a},backend:e});return e.disposeIntermediateTensorInfo(a),c}throw new Error(`Error in Cast: failed to cast ${n.dtype} to ${s}`)}var F_,O_=h(()=>{I();I();Nt();bn();Qr();X0();Pl();D_();F_={kernelName:En,backendName:"webgl",kernelFunc:j0}});var P_,qY,L_,M_=h(()=>{I();wt();Nt();P_="return ceil(x);",qY=pt({opSnippet:P_,packedOpSnippet:P_,cpuKernelImpl:Y$}),L_={kernelName:Ss,backendName:"webgl",kernelFunc:qY}});var nh,B_=h(()=>{nh=class{constructor(t){this.variableNames=["A"],this.customUniforms=[{name:"minVal",type:"float"},{name:"maxVal",type:"float"}],this.outputShape=t,this.userCode=`

      void main() {
        float value = getAAtOutCoords();
        if (isnan(value)) {
          setOutput(value);
          return;
        }

        setOutput(clamp(value, minVal, maxVal));
      }
    `}}});var sh,V_=h(()=>{sh=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"minVal",type:"float"},{name:"maxVal",type:"float"}],this.outputShape=t,this.userCode=`
      void main() {
        vec4 value = getAAtOutCoords();

        if (any(isnan(value))) {
          setOutput(value);
          return;
        }

        setOutput(clamp(value, vec4(minVal), vec4(maxVal)));
      }
    `}}});function XY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{clipValueMin:s,clipValueMax:a}=o,i;O().getBool("WEBGL_PACK_CLIP")?i=new sh(n.shape):i=new nh(n.shape);let c=[[s],[a]];return e.runWebGLProgram(i,[n],n.dtype,c)}var z_,G_=h(()=>{I();B_();V_();z_={kernelName:Ns,backendName:"webgl",kernelFunc:XY}});var ah,W_=h(()=>{ah=class{constructor(t){this.variableNames=["real","imag"],this.outputShape=t,this.userCode=`
      void main() {
        float re = abs(getRealAtOutCoords());
        float im = abs(getImagAtOutCoords());
        float mx = max(re, im);

        // sadly the length function in glsl is not underflow-safe
        // (at least not on Intel GPUs). So the safe solution is
        // to ensure underflow-safety in all cases.
        setOutput(
          mx == 0.0 ? 0.0 : mx * length(vec2(1, min(re, im)/mx))
        );
      }
    `}}});function U_(r,t){return{dataId:t.dataId,dtype:t.dtype,shape:r.shape}}function jY(r){let{inputs:t,backend:e}=r,{x:o}=t,n=e.texData.get(o.dataId),s=new ah(o.shape),a=[U_(o,n.complexTensorInfos.real),U_(o,n.complexTensorInfos.imag)];return e.runWebGLProgram(s,a,a[0].dtype)}var H_,K_=h(()=>{I();W_();H_={kernelName:Si,backendName:"webgl",kernelFunc:jY}});var ih,q_=h(()=>{I();ih=class{constructor(t){this.outputShape=[],this.outputShape=k.computeOutShape(t,1),this.variableNames=t.map((a,i)=>`T${i}`);let e=new Array(t.length-1);e[0]=t[0][1];for(let a=1;a<e.length;a++)e[a]=e[a-1]+t[a][1];let o=[`if (yC < ${e[0]}) setOutput(getT0(yR, yC));`];for(let a=1;a<e.length;a++){let i=e[a-1];o.push(`else if (yC < ${e[a]}) setOutput(getT${a}(yR, yC-${i}));`)}let n=e.length,s=e[e.length-1];o.push(`else setOutput(getT${n}(yR, yC-${s}));`),this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int yR = coords.x;
        int yC = coords.y;

        ${o.join(`
        `)}
      }
    `}}});function ch(r,t,e){let o=r.indexOf(t);return r.map((s,a)=>a===o?`${s} - ${e}`:s).join()}var lh,X_=h(()=>{I();No();de();lh=class{constructor(t,e){this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[],this.outputShape=k.computeOutShape(t,e);let o=this.outputShape,n=o.length,s=St(n),a=he("coords",n),i=["x","y","z","w","u","v"].slice(0,n);this.variableNames=t.map((x,g)=>`T${g}`);let c=new Array(t.length-1);c[0]=t[0][e];for(let x=1;x<c.length;x++)c[x]=c[x-1]+t[x][e];let l=i[e],u=i.slice(-2),p=i.join(),m=`if (${l} < ${c[0]}) {
        return getChannel(
            getT0(${p}), vec2(${u.join()}));
        }`;for(let x=1;x<c.length;x++){let g=c[x-1];m+=`
        if (${l} < ${c[x]}  && ${l} >= ${c[x-1]}) {
          return getChannel(
            getT${x}(${ch(i,l,g)}),
            vec2(${ch(u,l,g)}));
        }`}let f=c.length,d=c[c.length-1];m+=`
        return getChannel(
          getT${f}(${ch(i,l,d)}),
          vec2(${ch(u,l,d)}));`,this.userCode=`
      float getValue(${i.map(x=>"int "+x)}) {
        ${m}
      }

      void main() {
        ${s} coords = getOutputCoords();
        vec4 result = vec4(getValue(${a}), 0., 0., 0.);

        ${a[n-1]} = ${a[n-1]} + 1;
        if (${a[n-1]} < ${o[n-1]}) {
          result.g = getValue(${a});
        }

        ${a[n-2]} = ${a[n-2]} + 1;
        if (${a[n-2]} < ${o[n-2]}) {
          result.a = getValue(${a});
        }

        ${a[n-1]} = ${a[n-1]} - 1;
        if (${a[n-2]} < ${o[n-2]} &&
            ${a[n-1]} < ${o[n-1]}) {
          result.b = getValue(${a});
        }
        setOutput(result);
      }
    `}}});function ri(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.texData.get(o.dataId);return ge({inputs:{x:n.complexTensorInfos.imag},backend:e})}var j_,gp=h(()=>{I();Qr();j_={kernelName:Xi,backendName:"webgl",kernelFunc:ri}});function Ll(r,t,e){let o=r[0].dtype;if(o==="complex64"){let f=r.map(v=>wn({inputs:{input:v},backend:e})),d=r.map(v=>ri({inputs:{input:v},backend:e})),x=Ll(f,t,e),g=Ll(d,t,e),y=Sr({inputs:{real:x,imag:g},backend:e});return f.forEach(v=>e.disposeIntermediateTensorInfo(v)),d.forEach(v=>e.disposeIntermediateTensorInfo(v)),e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),y}let n=e.shouldExecuteOnCPU(r);if(o==="string"&&(n=!0),n){let f=r.map(S=>{let A=[-1,b.sizeFromShape(S.shape.slice(t))];return J({inputs:{x:S},backend:e,attrs:{shape:A}})}),d=f.map(S=>({vals:e.readSync(S.dataId),shape:S.shape})),x=k.computeOutShape(f.map(S=>S.shape),1),g=f[0].shape[0]===1,y=Z$(d,x,o,g),v=k.computeOutShape(r.map(S=>S.shape),t),N=e.makeTensorInfo(v,o,y);return f.forEach(S=>e.disposeIntermediateTensorInfo(S)),N}let s=r.filter(f=>b.sizeFromShape(f.shape)>0),a=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")&&s[0].shape.length>1;if(s.length===1){let f=a?new We(r[0].shape,jo):new wr(r[0].shape,jo);return e.runWebGLProgram(f,r,o)}let i=O().getNumber("WEBGL_MAX_TEXTURES_IN_SHADER");if(s.length>i){let f=[];for(let x=0;x<s.length;x+=i){let g=s.slice(x,x+i);f.push(Ll(g,t,e))}let d=Ll(f,t,e);for(let x of f)e.disposeIntermediateTensorInfo(x);return d}if(a){let f=new lh(s.map(d=>d.shape),t);return e.runWebGLProgram(f,s,o)}let{tensors2D:c,outShape:l}=YY(s,t,e),u=new ih(c.map(f=>f.shape)),p=e.runWebGLProgram(u,c,o);c.forEach(f=>e.disposeIntermediateTensorInfo(f));let m=J({inputs:{x:p},attrs:{shape:l},backend:e});return e.disposeIntermediateTensorInfo(p),m}function YY(r,t,e){let o=k.computeOutShape(r.map(s=>s.shape),t);return{tensors2D:r.map(s=>J({inputs:{x:s},attrs:{shape:[-1,b.sizeFromShape(s.shape.slice(t))]},backend:e})),outShape:o}}var Y_=h(()=>{I();q_();X_();Nt();Je();Qa();bn();gp();Pl();Xt();});function Y0(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o,s=b.parseAxisParam(n,t[0].shape)[0],a=t.map(l=>l.shape);k.assertParamsConsistent(a,s);let i=k.computeOutShape(t.map(l=>l.shape),s);if(b.sizeFromShape(i)===0)return e.makeTensorInfo(i,t[0].dtype,[]);let c=t.filter(l=>b.sizeFromShape(l.shape)>0);return c.length===1?ge({inputs:{x:c[0]},backend:e}):Ll(c,s,e)}var Z_,Z0=h(()=>{I();Y_();Qr();Z_={kernelName:Ni,backendName:"webgl",kernelFunc:Y0}});var Ml,uh,ph=h(()=>{Ml=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.outputShape=t.outShape;let a=t.padInfo.top,i=t.padInfo.left,c=t.strideHeight,l=t.strideWidth,u=t.dilationHeight,p=t.dilationWidth,m=t.filterHeight,f=t.filterWidth,d=Math.floor(t.inChannels/4)*4,x=t.inChannels%4,g=t.dataFormat==="channelsLast",y=g?1:2,v=g?2:3,N=g?3:1,S="",R="";o&&(n?S=`float activation(float a) {
          float b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?S=`float activation(float a) {
          float b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:S=`
          float activation(float x) {
            ${o}
          }
        `,R="result = activation(result);");let A=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${S}

      const ivec2 strides = ivec2(${c}, ${l});
      const ivec2 pads = ivec2(${a}, ${i});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d2 = coords[${N}];

        ivec2 xRCCorner =
            ivec2(coords[${y}], coords[${v}]) * strides - pads;
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // Convolve x(?, ?, d1) with w(:, :, d1, d2) to get y(yR, yC, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${m}; wR++) {
          int xR = xRCorner + wR * ${u};

          if (xR < 0 || xR >= ${t.inHeight}) {
            continue;
          }

          for (int wC = 0; wC < ${f}; wC++) {
            int xC = xCCorner + wC * ${p};

            if (xC < 0 || xC >= ${t.inWidth}) {
              continue;
            }

            for (int d1 = 0; d1 < ${d}; d1 += 4) {
              vec4 wValues = vec4(
                getW(wR, wC, d1, d2),
                getW(wR, wC, d1 + 1, d2),
                getW(wR, wC, d1 + 2, d2),
                getW(wR, wC, d1 + 3, d2)
              );

              if (${g}) {
                vec4 xValues = vec4(
                  getX(batch, xR, xC, d1),
                  getX(batch, xR, xC, d1 + 1),
                  getX(batch, xR, xC, d1 + 2),
                  getX(batch, xR, xC, d1 + 3)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec4 xValues = vec4(
                  getX(batch, d1, xR, xC),
                  getX(batch, d1 + 1, xR, xC),
                  getX(batch, d1 + 2, xR, xC),
                  getX(batch, d1 + 3, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }
            }

            if (${x===1}) {

              if (${g}) {
                dotProd +=
                    getX(batch, xR, xC, ${d}) *
                    getW(wR, wC, ${d}, d2);
              } else {
                dotProd +=
                    getX(batch, ${d}, xR, xC) *
                    getW(wR, wC, ${d}, d2);
              }

            } else if (${x===2}) {
              vec2 wValues = vec2(
                getW(wR, wC, ${d}, d2),
                getW(wR, wC, ${d} + 1, d2)
              );

              if (${g}) {
                vec2 xValues = vec2(
                  getX(batch, xR, xC, ${d}),
                  getX(batch, xR, xC, ${d} + 1)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec2 xValues = vec2(
                  getX(batch, ${d}, xR, xC),
                  getX(batch, ${d} + 1, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }

            } else if (${x===3}) {
              vec3 wValues = vec3(
                getW(wR, wC, ${d}, d2),
                getW(wR, wC, ${d} + 1, d2),
                getW(wR, wC, ${d} + 2, d2)
              );

              if (${g}) {
                vec3 xValues = vec3(
                  getX(batch, xR, xC, ${d}),
                  getX(batch, xR, xC, ${d} + 1),
                  getX(batch, xR, xC, ${d} + 2)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec3 xValues = vec3(
                  getX(batch, ${d}, xR, xC),
                  getX(batch, ${d} + 1, xR, xC),
                  getX(batch, ${d} + 2, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }

            }
          }
        }

        float result = dotProd;
        ${A}
        ${R}
        setOutput(result);
      }
    `}},uh=class{constructor(t){this.variableNames=["x","W"],this.outputShape=t.outShape;let e=t.padInfo.front,o=t.padInfo.top,n=t.padInfo.left,s=t.strideDepth,a=t.strideHeight,i=t.strideWidth,c=t.dilationDepth,l=t.dilationHeight,u=t.dilationWidth,p=t.filterDepth,m=t.filterHeight,f=t.filterWidth,d=Math.floor(t.inChannels/4)*4,x=t.inChannels%4;this.userCode=`
      const ivec3 strides = ivec3(${s}, ${a}, ${i});
      const ivec3 pads = ivec3(${e}, ${o}, ${n});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int d2 = coords.u;

        ivec3 xFRCCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
        int xFCorner = xFRCCorner.x;
        int xRCorner = xFRCCorner.y;
        int xCCorner = xFRCCorner.z;

        // Convolve x(?, ?, ?, d1) with w(:, :, :, d1, d2) to get
        // y(yF, yR, yC, d2). ? = to be determined. : = across all
        // values in that axis.
        float dotProd = 0.0;
        for (int wF = 0; wF < ${p}; wF++) {
          int xF = xFCorner + wF * ${c};

          if (xF < 0 || xF >= ${t.inDepth}) {
            continue;
          }

          for (int wR = 0; wR < ${m}; wR++) {
            int xR = xRCorner + wR * ${l};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${f}; wC++) {
              int xC = xCCorner + wC * ${u};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              for (int d1 = 0; d1 < ${d}; d1 += 4) {
                vec4 xValues = vec4(
                  getX(batch, xF, xR, xC, d1),
                  getX(batch, xF, xR, xC, d1 + 1),
                  getX(batch, xF, xR, xC, d1 + 2),
                  getX(batch, xF, xR, xC, d1 + 3)
                );
                vec4 wValues = vec4(
                  getW(wF, wR, wC, d1, d2),
                  getW(wF, wR, wC, d1 + 1, d2),
                  getW(wF, wR, wC, d1 + 2, d2),
                  getW(wF, wR, wC, d1 + 3, d2)
                );

                dotProd += dot(xValues, wValues);
              }

              if (${x===1}) {
                dotProd +=
                  getX(batch, xF, xR, xC, ${d}) *
                  getW(wF, wR, wC, ${d}, d2);
              } else if (${x===2}) {
                vec2 xValues = vec2(
                  getX(batch, xF, xR, xC, ${d}),
                  getX(batch, xF, xR, xC, ${d} + 1)
                );
                vec2 wValues = vec2(
                  getW(wF, wR, wC, ${d}, d2),
                  getW(wF, wR, wC, ${d} + 1, d2)
                );
                dotProd += dot(xValues, wValues);
              } else if (${x===3}) {
                vec3 xValues = vec3(
                  getX(batch, xF, xR, xC, ${d}),
                  getX(batch, xF, xR, xC, ${d} + 1),
                  getX(batch, xF, xR, xC, ${d} + 2)
                );
                vec3 wValues = vec3(
                  getW(wF, wR, wC, ${d}, d2),
                  getW(wF, wR, wC, ${d} + 1, d2),
                  getW(wF, wR, wC, ${d} + 2, d2)
                );
                dotProd += dot(xValues, wValues);
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}}});var Bl,Q0=h(()=>{I();Oe();Bl=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=qt(this.outputShape.length);let a=t.padInfo.left,i=t.strideWidth,c=t.dilationWidth,l=t.filterHeight,u=t.filterWidth,p=u,m=`
       int xR; int xC; int xCOffset;
       vec4 wTexel; vec4 previous; vec4 final;`;for(let g=0;g<u;g++)m+=`
           vec4 xTexelC${g*2};
           int xTexelC${g*2}Ready;
           vec4 xTexelC${g*2+1};
           int xTexelC${g*2+1}Ready;
           vec4 xC${g};`;m+=`
     for (int r = 0; r < ${l}; r++) {
      for (int d1 = 0; d1 < ${t.inChannels}; d1 += 2) {
       `;for(let g=0;g<u;g++)m+=`
           xTexelC${g*2} = vec4(0.0);
           xTexelC${g*2}Ready = 0;
           xTexelC${g*2+1} = vec4(0.0);
           xTexelC${g*2+1}Ready = 0;
           xC${g} = vec4(0.0);`;m+=`
         xR = xRCorner + r * dilations[0];
         if (xR >=0 && xR < inDims[0]) {
       `;for(let g=0;g<(p+1)/2;g++){let y=g*2;if(m+=`
           xC = xCCorner + ${y*c};
           `,i===1){if(y<u&&(a%2===1?(m+=`
                 xCOffset = xC + 1;
                 if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${y}Ready == 0) {
                   xTexelC${y} = getX(batch, xR, xCOffset, d1);

                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${y}.zw = vec2(0.0);
                   }
                   xTexelC${y}Ready = 1;
                 }
               `,c===1&&y>0?m+=`
                 xC${y} = vec4(xTexelC${y-2}.zw, xTexelC${y}.xy);
                 `:m+=`
                   xCOffset = xC + 1 - 2;

                   if (xCOffset >= 0 && xCOffset < inDims[1]) {
                     previous = getX(batch, xR, xCOffset, d1);

                     // Need to manually clear unused channels in case
                     // we're reading from recycled texture.
                     if (xCOffset + 1 >= inDims[1]) {
                       previous.zw = vec2(0.0);
                     }

                     xC${y} = vec4(previous.zw, xTexelC${y}.xy);
                   } else {
                     xC${y} = vec4(0.0, 0.0, xTexelC${y}.xy);
                   }
                   `):m+=`
                 if (xC >= 0 && xC < inDims[1] && xTexelC${y}Ready == 0) {
                   xTexelC${y} = getX(batch, xR, xC, d1);
                   if (xC + 1 >= inDims[1]) {
                     xTexelC${y}.zw = vec2(0.0);
                   }
                   xTexelC${y}Ready = 1;
                 }

                 xC${y} = xTexelC${y};
                 `,y+1<u)){let v=a%2===0?b.nearestLargerEven(c):c;c%2===0&&a%2===1||c%2!==0&&a%2!==1?(m+=`
                   xCOffset = xC + imod(pads[1], 2) + ${v};

                   if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${y+1}Ready == 0) {
                     xTexelC${y+1} = getX(batch, xR, xCOffset, d1);

                     // Need to manually clear unused channels in case
                     // we're reading from recycled texture.
                     if (xCOffset + 1 >= inDims[1]) {
                       xTexelC${y+1}.zw = vec2(0.0);
                     }
                     xTexelC${y+1}Ready = 1;
                   }
                   `,c>1?m+=`
                     xCOffset -= 2;
                     if (xCOffset >= 0 && xCOffset < inDims[1]) {
                      previous = getX(batch, xR, xCOffset, d1);
                      xC${y+1} = vec4(previous.zw, xTexelC${y+1}.xy);
                     } else {
                      xC${y+1} = vec4(0.0, 0.0, xTexelC${y+1}.xy);
                     }
                     `:m+=`
                     xC${y+1} = vec4(xTexelC${y}.zw, xTexelC${y+1}.xy);
                     `):v===1?m+=`
                     xC${y+1} = xTexelC${y};
                     `:m+=`
                     xCOffset = xC + ${v};

                     if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${y+1}Ready == 0) {
                       xTexelC${y+1} = getX(batch, xR, xCOffset, d1);
                       if (xCOffset + 1 >= inDims[1]) {
                         xTexelC${y+1}.zw = vec2(0.0);
                       }
                       xTexelC${y+1}Ready = 1;
                     }

                     xC${y+1} = xTexelC${y+1};
                     `}}else y<u&&(a%2===1?(m+=`
                 xCOffset = xC + 1 - strides[1];
                 if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${y}Ready == 0) {
                   xTexelC${y} = getX(batch, xR, xCOffset, d1);
                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${y}.zw = vec2(0.0);
                   }
                   xTexelC${y}Ready = 1;
                 }

                 if(xC + 1 >= 0 && xC + 1 < inDims[1] && xTexelC${y+1}Ready == 0) {
                   xTexelC${y+1} = getX(batch, xR, xC + 1, d1);
                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xC + 2 >= inDims[1]) {
                     xTexelC${y+1}.zw = vec2(0.0);
                   }
                   xTexelC${y+1}Ready = 1;
                 }

                 xC${y} = vec4(xTexelC${y}.zw, xTexelC${y+1}.zw);
               `,y+1<u&&(m+=`
                   final = vec4(0.0);
                   xCOffset = xC + 1 + strides[1];
                   if(xCOffset >= 0 && xCOffset < inDims[1]) {
                     final = getX(batch, xR, xCOffset, d1);
                   }
                   xC${y+1} = vec4(xTexelC${y+1}.xy, final.xy);
                 `)):(m+=`
                 if(xC >= 0 && xC < inDims[1] && xTexelC${y}Ready == 0) {
                   xTexelC${y} = getX(batch, xR, xC, d1);
                   if (xC + 1 >= inDims[1]) {
                     xTexelC${y}.zw = vec2(0.0);
                   }
                   xTexelC${y}Ready = 1;
                 }

                 xCOffset = xC + strides[1];
                 if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${y+1}Ready == 0) {
                   xTexelC${y+1} = getX(batch, xR, xCOffset, d1);
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${y+1}.zw = vec2(0.);
                   }
                   xTexelC${y+1}Ready = 1;
                 }

                 xC${y} = vec4(
                   xTexelC${y}.xy, xTexelC${y+1}.xy);
               `,y+1<u&&(m+=`
                   xC${y+1} = vec4(xTexelC${y}.zw, xTexelC${y+1}.zw);
                 `)));y<u&&(m+=`
             wTexel = getW(r, ${y}, d1, d2);
             dotProd += xC${y}.xxzz * vec4(wTexel.xy, wTexel.xy);
             if(d1 + 1 < ${t.inChannels}) {
               dotProd += xC${y}.yyww * vec4(wTexel.zw, wTexel.zw);
             }
           `,y+1<u&&(m+=`
               wTexel = getW(r, ${y+1}, d1, d2);
               dotProd += xC${y+1}.xxzz * vec4(wTexel.xy, wTexel.xy);
               if(d1 + 1 < ${t.inChannels}) {
                 dotProd += xC${y+1}.yyww * vec4(wTexel.zw, wTexel.zw);
               }
             `))}m+=`
     }
   `,m+=`
     }
   `,m+=`
     }
   `;let f="",d="";o&&(n?f=`vec4 activation(vec4 a) {
           vec4 b = getPreluActivationWeightsAtOutCoords();
           ${o}
         }`:s?f=`vec4 activation(vec4 a) {
           vec4 b = getLeakyreluAlphaAtOutCoords();
           ${o}
         }`:f=`vec4 activation(vec4 x) {
           ${o}
         }`,d="result = activation(result);");let x=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
       ${f}

       void main() {
         ivec4 coords = getOutputCoords();
         int batch = coords.x;
         ivec2 xRCCorner = coords.yz * strides - pads;
         int d2 = coords.w;
         int xRCorner = xRCCorner.x;
         int xCCorner = xRCCorner.y;

         //intialize dotProd with a small epsilon seems to reduce GPU accuracy loss.
         vec4 dotProd = vec4(0.000000000000001);

         ${m}

         vec4 result = dotProd - vec4(0.000000000000001);
         ${x}
         ${d}
         setOutput(result);
       }
     `}}});var mh,Q_=h(()=>{io();Oe();mh=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"inputShape",type:"ivec4"},{name:"pad",type:"ivec2"},{name:"stride",type:"ivec2"},{name:"dilation",type:"ivec2"},{name:"inChannels",type:"int"},{name:"itemsPerBlockRow",type:"int"},{name:"outWidth",type:"int"}],this.outputShape=t,this.enableShapeUniforms=qt(this.outputShape.length);let{dataFormat:o}=e,n=ie(),s=o==="channelsLast",a=s?1:2,i=s?2:3,c=this.enableShapeUniforms?"if(blockIndex < outShape[2] && pos < outShape[1]) {":`if(blockIndex < ${t[2]} && pos < ${t[1]}) {`,l="";for(let u=0;u<=1;u++)for(let p=0;p<=1;p++)l+=`
          blockIndex = rc.z + ${p};
          pos = rc.y + ${u};

          ${c}
            offsetY = int(blockIndex / outWidth) * stride[0] - pad[0];
            d0 = offsetY + dilation[0] * (pos / itemsPerBlockRow);

            if(d0 < inputShape[${a}] && d0 >= 0) {
              // Use custom imod instead mod. On Intel GPU, mod may generate
              // unexpected value.
              // https://github.com/tensorflow/tfjs/issues/5447
              offsetX = imod(blockIndex, outWidth) * stride[1] - pad[1];
              d1 = offsetX + dilation[1] * (imod(pos, itemsPerBlockRow) /
                  inChannels);

              if(d1 < inputShape[${i}] && d1 >= 0) {

                ch = imod(pos, inChannels);

                if (${s}) {
                  innerDims = vec2(d1, ch);
                  result[${u*2+p}] = getChannel(
                    getA(rc.x, d0, int(innerDims.x),
                    int(innerDims.y)), innerDims);
                } else {
                  innerDims = vec2(d0, d1);
                  result[${u*2+p}] = getChannel(
                    getA(rc.x, ch, int(innerDims.x),
                    int(innerDims.y)), innerDims);
                }
              }
            }
          }
        `;this.userCode=`
      void main() {
        ivec3 rc = getOutputCoords();

        vec4 result = vec4(0);

        int blockIndex, pos, offsetY, d0, offsetX, d1, ch;
        vec2 innerDims;

        ${l}

        ${n.output} = result;
      }
    `}}});function fh(r,t){let e=r.length;return e>=3?t?[...r.slice(0,-3),r[e-3]*r[e-2],r[e-1]]:[...r.slice(0,-3),r[e-3],r[e-2]*r[e-1]]:!t&&e===1&&r[0]>1?[r[0],1]:null}function dh({x:r,filter:t,convInfo:e,backend:o,bias:n=null,preluActivationWeights:s=null,leakyreluAlpha:a=0,activation:i=null}){let c=r.shape,l=o.texData.get(r.dataId),u=e.inChannels,p=c[0]*c[1]*c[2],m=e.outChannels,f=e.dataFormat==="channelsLast",d=!1,x=!1,g,y=[];if(s!=null){let S=fh(s.shape,f);S!=null&&(s=J({inputs:{x:s},backend:o,attrs:{shape:S}}),y.push(s))}if(n!=null){let S=fh(n.shape,f);S!=null&&(n=J({inputs:{x:n},backend:o,attrs:{shape:S}}),y.push(n))}if(!((p===1||m===1)&&u>W0)&&l.isPacked&&f&&l.texture!=null&&c[2]%2!==0&&b.arraysEqual(l.shape.slice(-3),c.slice(-3))){let S=c[0]*c[1]*(c[2]+1),R={dataId:r.dataId,shape:[1,S,e.inChannels],dtype:r.dtype},A=l.shape;l.shape=l.shape.slice(),l.shape[l.shape.length-2]++,b.assert(Wa(l.shape,R.shape),()=>`packed reshape ${l.shape} to ${R.shape} isn't free`);let _=J({inputs:{x:t},backend:o,attrs:{shape:[1,e.inChannels,e.outChannels]}});y.push(_);let D=ti({a:R,b:_,backend:o,transposeA:d,transposeB:x,bias:n,activation:i,preluActivationWeights:s,leakyreluAlpha:a}),L=o.texData.get(D.dataId);b.assert(L.isPacked,()=>"batchMatMul result is expected to be packed"),l.shape=A,L.shape=e.outShape,g=ge({inputs:{x:D},backend:o}),g.shape=e.outShape,y.push(D)}else{let S=e.outHeight*e.outWidth,R=J({inputs:{x:r},backend:o,attrs:{shape:f?[e.batchSize,S,e.inChannels]:[e.batchSize,e.inChannels,S]}}),A=J({inputs:{x:t},backend:o,attrs:{shape:[1,e.inChannels,e.outChannels]}}),_=ti({a:f?R:A,b:f?A:R,transposeA:!f,transposeB:x,backend:o,bias:n,activation:i,preluActivationWeights:s,leakyreluAlpha:a});g=J({inputs:{x:_},backend:o,attrs:{shape:e.outShape}}),y.push(R),y.push(A),y.push(_)}for(let S of y)o.disposeIntermediateTensorInfo(S);return g}function hh({x:r,filter:t,convInfo:e,backend:o,bias:n=null,preluActivationWeights:s=null,leakyreluAlpha:a=0,activation:i=null}){let{filterWidth:c,filterHeight:l,inChannels:u,outWidth:p,outHeight:m,dataFormat:f}=e,d=f==="channelsLast",x=c*l*u,g=m*p,y=[e.batchSize,x,g],v=!0,N=!1,S=[];if(s!=null){let q=fh(s.shape,d);q!=null&&(s=J({inputs:{x:s},backend:o,attrs:{shape:q}}),S.push(s))}if(n!=null){let q=fh(n.shape,d);q!=null&&(n=J({inputs:{x:n},backend:o,attrs:{shape:q}}),S.push(n))}let R=J({inputs:{x:t},backend:o,attrs:{shape:[1,x,b.sizeFromShape(t.shape)/x]}});S.push(R);let A=new mh(y,e),_=[r.shape,[e.padInfo.top,e.padInfo.left],[e.strideHeight,e.strideWidth],[e.dilationHeight,e.dilationWidth],[e.inChannels],[e.filterWidth*e.inChannels],[e.outWidth]],D=o.runWebGLProgram(A,[r],"float32",_),L=J({inputs:{x:D},backend:o,attrs:{shape:y}});S.push(D),S.push(L);let M=n!=null,V=s!=null,W=i==="leakyrelu",G=i?vn(i,!0):null,K=new Fl(d?L.shape:R.shape,d?R.shape:L.shape,d?[e.batchSize,g,e.outChannels]:[e.batchSize,e.outChannels,g],v,N,M,G,V,W),U=d?[L,R]:[R,L];if(n&&U.push(n),V&&U.push(s),W){let q=o.makeTensorInfo([],"float32",b.createScalarValue(a,"float32"));U.push(q),S.push(q)}let j=o.runWebGLProgram(K,U,"float32"),Z=J({inputs:{x:j},backend:o,attrs:{shape:e.outShape}});S.push(j);for(let q of S)o.disposeIntermediateTensorInfo(q);return Z}var J0=h(()=>{I();Q_();wt();V0();Fr();Hd();Qr();Xt();});function ZY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dataFormat:c,dilations:l,dimRoundingMode:u}=o,p=k.convertConv2DDataFormat(c),m=k.computeConv2DInfo(n.shape,s.shape,a,l,i,u,!1,p),f;if(m.filterHeight===1&&m.filterWidth===1&&m.dilationHeight===1&&m.dilationWidth===1&&m.strideHeight===1&&m.strideWidth===1&&(m.padInfo.type==="SAME"||m.padInfo.type==="VALID"))f=dh({x:n,filter:s,convInfo:m,backend:e});else if(m.strideWidth<=2&&p==="channelsLast"&&O().getBool("WEBGL_EXP_CONV")){let x=new Bl(m),g=[[m.padInfo.top,m.padInfo.left],[m.strideHeight,m.strideWidth],[m.dilationHeight,m.dilationWidth],[m.inHeight,m.inWidth]];f=e.runWebGLProgram(x,[n,s],"float32",g)}else if(O().getBool("WEBGL_CONV_IM2COL"))f=hh({x:n,filter:s,convInfo:m,backend:e});else{let x=new Ml(m);f=e.runWebGLProgram(x,[n,s],"float32")}let d=J({inputs:{x:f},backend:e,attrs:{shape:m.outShape}});return e.disposeIntermediateTensorInfo(f),d}var J_,tD=h(()=>{I();ph();Q0();J0();Xt();J_={kernelName:Ti,backendName:"webgl",kernelFunc:ZY}});var gh,xh,yh,bh,xp=h(()=>{gh=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideHeight,o=t.strideWidth,n=t.padInfo.top,s=t.padInfo.left,a=t.dataFormat==="channelsLast";this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int wR = coords.x;
        int wC = coords.y;
        int d1 = coords.z;
        int d2 = coords.w;

        // Convolve x(?, ?, d1) with dy(:, :, d2) to get dw(wR, wC, d1, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yR = 0; yR < ${t.outHeight}; yR++) {
            int xR = wR + yR * ${e} - ${n};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int yC = 0; yC < ${t.outWidth}; yC++) {
              int xC = wC + yC * ${o} - ${s};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              ${a?`float dyValue = getDy(b, yR, yC, d2);
              float xValue = getX(b, xR, xC, d1);
              dotProd += (xValue * dyValue);`:`float dyValue = getDy(b, d2, yR, yC);
              float xValue = getX(b, d1, xR, xC);
              dotProd += (xValue * dyValue);`}
            }
          }
        }
        setOutput(dotProd);
      }
    `}},xh=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,a=t.dataFormat==="channelsLast",i=e-1-t.padInfo.top,c=o-1-t.padInfo.left,l=a?1:2,u=a?2:3,p=a?3:1;this.userCode=`
      const ivec2 pads = ivec2(${i}, ${c});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[${p}];

        ivec2 dyCorner = ivec2(coords[${l}], coords[${u}]) - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            int wCPerm = ${o} - 1 - wC;

            for (int d2 = 0; d2 < ${t.outChannels}; d2++) {

              if (${a}) {
                float xValue = getDy(batch, idyR, idyC, d2);
                float wValue = getW(wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              } else {
                float xValue = getDy(batch, d2, idyR, idyC);
                float wValue = getW(wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              }

            }
          }
        }
        setOutput(dotProd);
      }
    `}},yh=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideDepth,o=t.strideHeight,n=t.strideWidth,s=t.padInfo.front,a=t.padInfo.top,i=t.padInfo.left;this.userCode=`
      void main() {
        ivec5 coords = getOutputCoords();
        int wF = coords.x;
        int wR = coords.y;
        int wC = coords.z;
        int d1 = coords.w;
        int d2 = coords.u;

        float dotProd = 0.0;

        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yF = 0; yF < ${t.outDepth}; yF++) {
            int xF = wF + yF * ${e} - ${s};

            if (xF < 0 || xF >= ${t.inDepth}) {
              continue;
            }

            for (int yR = 0; yR < ${t.outHeight}; yR++) {
              int xR = wR + yR * ${o} - ${a};

              if (xR < 0 || xR >= ${t.inHeight}) {
                continue;
              }

              for (int yC = 0; yC < ${t.outWidth}; yC++) {
                int xC = wC + yC * ${n} - ${i};

                if (xC < 0 || xC >= ${t.inWidth}) {
                  continue;
                }

                float dyValue = getDy(b, yF, yR, yC, d2);
                float xValue = getX(b, xF, xR, xC, d1);
                dotProd += (xValue * dyValue);
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}},bh=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterDepth,o=t.filterHeight,n=t.filterWidth,s=t.strideDepth,a=t.strideHeight,i=t.strideWidth,c=e-1-t.padInfo.front,l=o-1-t.padInfo.top,u=n-1-t.padInfo.left;this.userCode=`
      const ivec3 pads = ivec3(${c}, ${l}, ${u});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int d1 = coords.u;


        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyFCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        float dotProd = 0.0;
        for (int wF = 0; wF < ${e}; wF++) {
          float dyF = float(dyFCorner + wF) / ${s}.0;

          if (dyF < 0.0 || dyF >= ${t.outDepth}.0 || fract(dyF) > 0.0) {
            continue;
          }
          int idyF = int(dyF);

          int wFPerm = ${e} - 1 - wF;

          for (int wR = 0; wR < ${o}; wR++) {
            float dyR = float(dyRCorner + wR) / ${a}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
              fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            int wRPerm = ${o} - 1 - wR;

            for (int wC = 0; wC < ${n}; wC++) {
              float dyC = float(dyCCorner + wC) / ${i}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              int wCPerm = ${n} - 1 - wC;

              for (int d2 = 0; d2 < ${t.outChannels}; d2++) {
                float xValue = getDy(batch, idyF, idyR, idyC, d2);
                float wValue = getW(wFPerm, wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}}});function QY(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,pad:i,dataFormat:c,dimRoundingMode:l,filterShape:u}=o,p=k.convertConv2DDataFormat(c),m=k.computeConv2DInfo(n.shape,u,a,1,i,l,!1,p),f=new gh(m);return e.runWebGLProgram(f,[n,s],"float32")}var eD,rD=h(()=>{I();xp();eD={kernelName:Ii,backendName:"webgl",kernelFunc:QY}});var vh,oD=h(()=>{Oe();vh=class{constructor(t){this.variableNames=["dy","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"strides",type:"vec2"}],this.outputShape=t.inShape,this.enableShapeUniforms=qt(this.outputShape.length);let e=t.filterHeight,o=t.filterWidth,n=e-1-t.padInfo.top,s=o-1-t.padInfo.left;this.userCode=`
      const ivec2 pads = ivec2(${n}, ${s});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[3];

        ivec2 dyCorner = ivec2(coords[1], coords[2]) - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        vec4 result = vec4(0.);
        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / strides[0];
          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);
          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            int wCPerm = ${o} - 1 - wC;

            float dyC = float(dyCCorner + wC) / strides[1];
            bool idyCVal = (dyC >= 0.0) && (dyC < ${t.outWidth}.0)
              && (fract(dyC) == 0.0);
            int idyC = int(dyC);

            float dyC2 = float(dyCCorner + wC + 1) / strides[1];
            bool idyCVal2 = (dyC2 >= 0.0) && (dyC2 < ${t.outWidth}.0)
              && (fract(dyC2) == 0.0);
            int idyC2 = int(dyC2);

            if (idyCVal && idyCVal2) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC, d2);
                vec4 dySample2 = (idyC / 2 == idyC2 / 2) ?
                  dySample : getDy(batch, idyR, idyC2, d2);

                vec2 dyValue = mod(float(idyC), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.xy += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));

                dyValue = mod(float(idyC2), 2.) == 0. ?
                  dySample2.xy : dySample2.zw;
                result.zw += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            } else if (idyCVal) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC, d2);
                vec2 dyValue = mod(float(idyC), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.xy += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            } else if (idyCVal2) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC2, d2);
                vec2 dyValue = mod(float(idyC2), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.zw += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            }
          }
        }
        setOutput(result);
      }
    `}}});function JY(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{inputShape:a,strides:i,pad:c,dataFormat:l,dimRoundingMode:u}=o,p=k.convertConv2DDataFormat(l),m=k.computeConv2DInfo(a,s.shape,i,1,c,u,!1,p);if(O().getBool("WEBGL_PACK_CONV2DTRANSPOSE")&&p==="channelsLast"){let f=[[m.strideHeight,m.strideWidth]],d=new vh(m);return e.runWebGLProgram(d,[n,s],"float32",f)}else{let f=new xh(m);return e.runWebGLProgram(f,[n,s],"float32")}}var nD,sD=h(()=>{I();xp();oD();nD={kernelName:ki,backendName:"webgl",kernelFunc:JY}});function t7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dilations:c}=o,l=k.computeConv3DInfo(n.shape,s.shape,a,c,i),u=new uh(l);return e.runWebGLProgram(u,[n,s],"float32")}var aD,iD=h(()=>{I();ph();aD={kernelName:Ei,backendName:"webgl",kernelFunc:t7}});function e7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,pad:i,filterShape:c}=o,l=k.computeConv3DInfo(n.shape,c,a,1,i),u=new yh(l);return e.runWebGLProgram(u,[n,s],"float32")}var cD,lD=h(()=>{I();xp();cD={kernelName:Hp,backendName:"webgl",kernelFunc:e7}});function r7(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{pad:a,strides:i,inputShape:c}=o,l=k.computeConv3DInfo(c,s.shape,i,1,a),u=new bh(l);return e.runWebGLProgram(u,[n,s],"float32")}var uD,pD=h(()=>{I();xp();uD={kernelName:$i,backendName:"webgl",kernelFunc:r7}});var o7,n7,s7,mD,fD=h(()=>{I();Mr();wt();o7=mo+`
  return cos(x);
`,n7=`
  vec4 result = cos(x);
  bvec4 isNaN = isnan(x);
  ${Lr}
  return result;
`,s7=pt({opSnippet:o7,packedOpSnippet:n7}),mD={kernelName:"Cos",backendName:"webgl",kernelFunc:s7}});var a7,i7,dD,hD=h(()=>{I();wt();a7=`
  float e2x = exp(-x);
  return (e2x + 1.0 / e2x) / 2.0;
`,i7=pt({opSnippet:a7}),dD={kernelName:Ts,backendName:"webgl",kernelFunc:i7}});var wh,gD=h(()=>{wh=class{constructor(t,e,o,n,s){this.variableNames=["Image","Boxes","BoxInd"],this.outputShape=[];let[a,i,c,l]=t,[u]=e,[p,m]=o;this.outputShape=[u,p,m,l];let f=n==="bilinear"?1:0,[d,x]=[`${i-1}.0`,`${c-1}.0`],[g,y,v]=p>1?[`${(i-1)/(p-1)}`,"(y2-y1) * height_ratio",`y1*${d} + float(y)*(height_scale)`]:["0.0","0.0",`0.5 * (y1+y2) * ${d}`],[N,S,R]=m>1?[`${(c-1)/(m-1)}`,"(x2-x1) * width_ratio",`x1*${x} + float(x)*(width_scale)`]:["0.0","0.0",`0.5 * (x1+x2) * ${x}`];this.userCode=`
      const float height_ratio = float(${g});
      const float width_ratio = float(${N});
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int y = coords[1];
        int x = coords[2];
        int d = coords[3];

        // get box vals
        float y1 = getBoxes(b,0);
        float x1 = getBoxes(b,1);
        float y2 = getBoxes(b,2);
        float x2 = getBoxes(b,3);

        // get image in batch index
        int bInd = round(getBoxInd(b));
        if(bInd < 0 || bInd >= ${a}) {
          return;
        }

        float height_scale = ${y};
        float width_scale = ${S};

        float in_y = ${v};
        if( in_y < 0.0 || in_y > ${d} ) {
          setOutput(float(${s}));
          return;
        }
        float in_x = ${R};
        if( in_x < 0.0 || in_x > ${x} ) {
          setOutput(float(${s}));
          return;
        }

        vec2 sourceFracIndexCR = vec2(in_x,in_y);
        if(${f} == 1) {
          // Compute the four integer indices.
          ivec2 sourceFloorCR = ivec2(sourceFracIndexCR);
          ivec2 sourceCeilCR = ivec2(ceil(sourceFracIndexCR));

          float topLeft = getImage(b, sourceFloorCR.y, sourceFloorCR.x, d);
          float bottomLeft = getImage(b, sourceCeilCR.y, sourceFloorCR.x, d);
          float topRight = getImage(b, sourceFloorCR.y, sourceCeilCR.x, d);
          float bottomRight = getImage(b, sourceCeilCR.y, sourceCeilCR.x, d);

          vec2 fracCR = sourceFracIndexCR - vec2(sourceFloorCR);

          float top = topLeft + (topRight - topLeft) * fracCR.x;
          float bottom = bottomLeft + (bottomRight - bottomLeft) * fracCR.x;
          float newValue = top + (bottom - top) * fracCR.y;
          setOutput(newValue);
        } else {
          // Compute the coordinators of nearest neighbor point.
          ivec2 sourceNearestCR = ivec2(floor(
            sourceFracIndexCR + vec2(0.5,0.5)));
          float newValue = getImage(b, sourceNearestCR.y, sourceNearestCR.x, d);
          setOutput(newValue);
        }
      }
    `}}});var c7,xD,yD=h(()=>{I();gD();c7=r=>{let{inputs:t,backend:e,attrs:o}=r,{image:n,boxes:s,boxInd:a}=t,{cropSize:i,method:c,extrapolationValue:l}=o,u=new wh(n.shape,s.shape,i,c,l);return e.runWebGLProgram(u,[n,s,a],"float32")},xD={kernelName:_i,backendName:"webgl",kernelFunc:c7}});function bD(r,t,e){if(r===1)return`${t}`;if(r===2)return`${t}.x, ${t}.y`;if(r===3)return`${t}.x, ${t}.y, ${t}.z`;if(r===4)return`${t}.x, ${t}.y, ${t}.z, ${t}.w`;throw new Error(`Cumulative ${e} for rank ${r} is not yet supported`)}function vD(r,t,e){if(r===1)return`${t}`;if(r===2)return`${t}.y`;if(r===3)return`${t}.z`;if(r===4)return`${t}.w`;throw new Error(`Cumulative ${e} for rank ${r} is not yet supported`)}var oi,yp,Ch=h(()=>{de();(function(r){r.Prod="*",r.Sum="+"})(oi||(oi={}));yp=class{constructor(t,e,o,n){this.op=t,this.outputShape=e,this.variableNames=["x"],this.customUniforms=[{name:"index",type:"float"}];let s=this.outputShape.length,a=this.op===oi.Prod?"1.0":"0.0",i=o?a:`getX(${bD(s,"coords",this.op)})`,c=this.outputShape[this.outputShape.length-1],l="",u="";o?(l=n?`end != ${c-1}`:"end != 0",u=n?"end + 1":"end - 1"):(l=n?`end + pow2 < ${c}`:"end >= pow2",u=n?"end + pow2":"end - pow2"),this.userCode=`
      void main() {
        ${St(s)} coords = getOutputCoords();
        int end = ${vD(s,"coords",this.op)};
        float val = ${i};
        int pow2 = int(pow(2.0, index));
        if (${l}) {
          int idx = ${u};
          ${vD(s,"coords",this.op)} = idx;
          val ${this.op}= getX(${bD(s,"coords",this.op)});
        }
        setOutput(val);
      }
    `}}});function Sh(r,t,e,o,n,s){let a=t.shape.length,i=k.getAxesPermutation([o],a),c=t;i!=null&&(c=re({inputs:{x:t},backend:e,attrs:{perm:i}}));let l=k.getInnerMostAxes(1,a)[0];if(l!==a-1)throw new Error(`WebGL cumprod shader expects an inner-most axis=${t.shape.length-1} but got axis=${o}`);let u=c.shape[l],p=ge({inputs:{x:c},backend:e});for(let m=0;m<=Math.ceil(Math.log2(u))-1;m++){let f=new yp(r,c.shape,!1,s),d=[[m]],x=p;p=e.runWebGLProgram(f,[p],p.dtype,d),e.disposeIntermediateTensorInfo(x)}if(n){let m=new yp(r,c.shape,n,s),f=p;p=e.runWebGLProgram(m,[p],p.dtype),e.disposeIntermediateTensorInfo(f)}if(i!=null){let m=k.getUndoAxesPermutation(i),f=re({inputs:{x:p},backend:e,attrs:{perm:m}});return e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(c),f}return p}var tv=h(()=>{I();Ch();Qr();Vr();});function l7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:a,reverse:i}=o;return Sh(oi.Prod,n,e,s,a,i)}var wD,CD=h(()=>{I();Ch();tv();wD={kernelName:Ri,backendName:"webgl",kernelFunc:l7}});function u7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:a,reverse:i}=o;return Sh(oi.Sum,n,e,s,a,i)}var SD,ND=h(()=>{I();Ch();tv();SD={kernelName:Ai,backendName:"webgl",kernelFunc:u7}});function p7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:a,binaryOutput:i}=o;if(n.shape.length===1){let c=e.readSync(n.dataId),l=e.readSync(s.dataId),u=Fd(c,l,s.dtype,s.shape,a);return e.makeTensorInfo([a],s.dtype,u)}else if(n.shape.length===2){let c=e.bufferSync(n),l=e.bufferSync(s),u=q$(c,l,a,i);return e.makeTensorInfo(u.shape,s.dtype,u.values)}throw new Error(`Error in denseBincount: input must be at most rank 2, but got rank${n.shape.length}.`)}var TD,ID=h(()=>{I();Nt();TD={kernelName:Di,backendName:"webgl",kernelFunc:p7}});var Nh,kD=h(()=>{Nh=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=[],this.outputShape=t,this.blockSize=e,this.dataFormat=o,this.userCode=`
    void main() {
      ivec4 coords = getOutputCoords();
      int b = coords[0];
      int h = ${this.getHeightCoordString()};
      int w = ${this.getWidthCoordString()};
      int d = ${this.getDepthCoordString()};

      int in_h = h / ${e};
      int offset_h = imod(h, ${e});
      int in_w = w / ${e};
      int offset_w = imod(w, ${e});
      int offset_d = (offset_h * ${e} + offset_w) *
        ${this.getOutputDepthSize()};
      int in_d = d + offset_d;

      float result = ${this.getInputSamplingString()};
      setOutput(result);
    }
  `}getHeightCoordString(){return this.dataFormat==="NHWC"?"coords[1]":"coords[2]"}getWidthCoordString(){return this.dataFormat==="NHWC"?"coords[2]":"coords[3]"}getDepthCoordString(){return this.dataFormat==="NHWC"?"coords[3]":"coords[1]"}getOutputDepthSize(){return this.dataFormat==="NHWC"?this.outputShape[3]:this.outputShape[1]}getInputSamplingString(){return this.dataFormat==="NHWC"?"getX(b, in_h, in_w, in_d)":"getX(b, in_d, in_h, in_w)"}}});function m7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockSize:s,dataFormat:a}=o,i=n.shape[0],c=a==="NHWC"?n.shape[1]:n.shape[2],l=a==="NHWC"?n.shape[2]:n.shape[3],u=a==="NHWC"?n.shape[3]:n.shape[1],p=c*s,m=l*s,f=u/(s*s),d=a==="NHWC"?[i,p,m,f]:[i,f,p,m],x=new Nh(d,s,a);return e.runWebGLProgram(x,[n],n.dtype)}var ED,$D=h(()=>{I();kD();ED={kernelName:Fi,backendName:"webgl",kernelFunc:m7}});var Vl,ev=h(()=>{Oe();Vl=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=qt(this.outputShape.length);let a=t.filterHeight,i=t.filterWidth,c=t.outChannels/t.inChannels,l="",u="";o&&(n?l=`float activation(float a) {
          float b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?l=`float activation(float a) {
          float b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:l=`
          float activation(float x) {
            ${o}
          }
        `,u="result = activation(result);");let p=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${l}

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        ivec2 xRCCorner = coords.yz * strides - pads;
        int d2 = coords.w;
        int d1 = d2 / ${c};
        int q = d2 - d1 * ${c};

        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // Convolve x(?, ?, d1) with w(:, :, d1, q) to get y(yR, yC, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        // TO DO(dsmilkov): Flatten the two for loops and vec4 the operations.
        for (int wR = 0; wR < ${a}; wR++) {
          int xR = xRCorner + wR * dilations[0];

          if (xR < 0 || xR >= inDims[0]) {
            continue;
          }

          for (int wC = 0; wC < ${i}; wC++) {
            int xC = xCCorner + wC * dilations[1];

            if (xC < 0 || xC >= inDims[1]) {
              continue;
            }

            float xVal = getX(batch, xR, xC, d1);
            float wVal = getW(wR, wC, d1, q);
            dotProd += xVal * wVal;
          }
        }

        float result = dotProd;
        ${p}
        ${u}
        setOutput(result);
      }
    `}}});var zl,rv=h(()=>{I();Oe();zl=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=qt(this.outputShape.length);let a=t.outChannels/t.inChannels,i=t.padInfo.left,c=t.strideWidth,l=t.dilationWidth,u=t.filterHeight,p=t.filterWidth,m=p,f=`
      int xR; int xC; int xCOffset;
      vec4 wTexel; vec4 previous; vec4 final;`;for(let y=0;y<p;y++)f+=`
          vec4 xTexelC${y*2};
          int xTexelC${y*2}Ready;
          vec4 xTexelC${y*2+1};
          int xTexelC${y*2+1}Ready;
          vec4 xC${y};`;f+=`
    for (int r = 0; r < ${u}; r++) {
      `;for(let y=0;y<p;y++)f+=`
          xTexelC${y*2} = vec4(0.0);
          xTexelC${y*2}Ready = 0;
          xTexelC${y*2+1} = vec4(0.0);
          xTexelC${y*2+1}Ready = 0;
          xC${y} = vec4(0.0);`;f+=`
        xR = xRCorner + r * dilations[0];
        if (xR >=0 && xR < inDims[0]) {
      `;for(let y=0;y<(m+1)/2;y++){let v=y*2;if(f+=`
          xC = xCCorner + ${v*l};
          `,c===1){if(v<p&&(i%2===1?(f+=`
                xCOffset = xC + 1;
                if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${v}Ready == 0) {
                  xTexelC${v} = getX(batch, xR, xCOffset, d1);

                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${v}.zw = vec2(0.0);
                  }
                  xTexelC${v}Ready = 1;
                }
              `,l===1&&v>0?f+=`
                xC${v} = vec4(xTexelC${v-2}.zw, xTexelC${v}.xy);
                `:f+=`
                  xCOffset = xC + 1 - 2;

                  if (xCOffset >= 0 && xCOffset < inDims[1]) {
                    previous = getX(batch, xR, xCOffset, d1);

                    // Need to manually clear unused channels in case
                    // we're reading from recycled texture.
                    if (xCOffset + 1 >= inDims[1]) {
                      previous.zw = vec2(0.0);
                    }

                    xC${v} = vec4(previous.zw, xTexelC${v}.xy);
                  } else {
                    xC${v} = vec4(0.0, 0.0, xTexelC${v}.xy);
                  }
                  `):f+=`
                if (xC >= 0 && xC < inDims[1] && xTexelC${v}Ready == 0) {
                  xTexelC${v} = getX(batch, xR, xC, d1);
                  if (xC + 1 >= inDims[1]) {
                    xTexelC${v}.zw = vec2(0.0);
                  }
                  xTexelC${v}Ready = 1;
                }

                xC${v} = xTexelC${v};
                `,v+1<p)){let N=i%2===0?b.nearestLargerEven(l):l;l%2===0&&i%2===1||l%2!==0&&i%2!==1?(f+=`
                  xCOffset = xC + imod(pads[1], 2) + ${N};

                  if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${v+1}Ready == 0) {
                    xTexelC${v+1} = getX(batch, xR, xCOffset, d1);

                    // Need to manually clear unused channels in case
                    // we're reading from recycled texture.
                    if (xCOffset + 1 >= inDims[1]) {
                      xTexelC${v+1}.zw = vec2(0.0);
                    }
                    xTexelC${v+1}Ready = 1;
                  }
                  `,l>1?f+=`
                    xCOffset -= 2;
                    if (xCOffset >= 0 && xCOffset < inDims[1]) {
                     previous = getX(batch, xR, xCOffset, d1);
                     xC${v+1} = vec4(previous.zw, xTexelC${v+1}.xy);
                    } else {
                     xC${v+1} = vec4(0.0, 0.0, xTexelC${v+1}.xy);
                    }
                    `:f+=`
                    xC${v+1} = vec4(xTexelC${v}.zw, xTexelC${v+1}.xy);
                    `):N===1?f+=`
                    xC${v+1} = xTexelC${v};
                    `:f+=`
                    xCOffset = xC + ${N};

                    if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${v+1}Ready == 0) {
                      xTexelC${v+1} = getX(batch, xR, xCOffset, d1);
                      if (xCOffset + 1 >= inDims[1]) {
                        xTexelC${v+1}.zw = vec2(0.0);
                      }
                      xTexelC${v+1}Ready = 1;
                    }

                    xC${v+1} = xTexelC${v+1};
                    `}}else v<p&&(i%2===1?(f+=`
                xCOffset = xC + 1 - strides[1];
                if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${v}Ready == 0) {
                  xTexelC${v} = getX(batch, xR, xCOffset, d1);
                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${v}.zw = vec2(0.0);
                  }
                  xTexelC${v}Ready = 1;
                }

                if(xC + 1 >= 0 && xC + 1 < inDims[1] && xTexelC${v+1}Ready == 0) {
                  xTexelC${v+1} = getX(batch, xR, xC + 1, d1);
                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xC + 2 >= inDims[1]) {
                    xTexelC${v+1}.zw = vec2(0.0);
                  }
                  xTexelC${v+1}Ready = 1;
                }

                xC${v} = vec4(xTexelC${v}.zw, xTexelC${v+1}.zw);
              `,v+1<p&&(f+=`
                  final = vec4(0.0);
                  xCOffset = xC + 1 + strides[1];
                  if(xCOffset >= 0 && xCOffset < inDims[1]) {
                    final = getX(batch, xR, xCOffset, d1);
                  }
                  xC${v+1} = vec4(xTexelC${v+1}.xy, final.xy);
                `)):(f+=`
                if(xC >= 0 && xC < inDims[1] && xTexelC${v}Ready == 0) {
                  xTexelC${v} = getX(batch, xR, xC, d1);
                  if (xC + 1 >= inDims[1]) {
                    xTexelC${v}.zw = vec2(0.0);
                  }
                  xTexelC${v}Ready = 1;
                }

                xCOffset = xC + strides[1];
                if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${v+1}Ready == 0) {
                  xTexelC${v+1} = getX(batch, xR, xCOffset, d1);
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${v+1}.zw = vec2(0.);
                  }
                  xTexelC${v+1}Ready = 1;
                }

                xC${v} = vec4(
                  xTexelC${v}.xy, xTexelC${v+1}.xy);
              `,v+1<p&&(f+=`
                  xC${v+1} = vec4(xTexelC${v}.zw, xTexelC${v+1}.zw);
                `)));v<p&&(f+=`
            wTexel = getW(r, ${v}, d1, q);
            dotProd += xC${v} * vec4(wTexel.xz, wTexel.xz);
          `,v+1<p&&(f+=`
              wTexel = getW(r, ${v+1}, d1, q);
              dotProd += xC${v+1} * vec4(wTexel.xz, wTexel.xz);
            `))}f+=`
    }
  `,f+=`
      }
    `;let d="",x="";o&&(n?d=`vec4 activation(vec4 a) {
          vec4 b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?d=`vec4 activation(vec4 a) {
          vec4 b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:d=`vec4 activation(vec4 x) {
          ${o}
        }`,x="result = activation(result);");let g=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${d}

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        ivec2 xRCCorner = coords.yz * strides - pads;
        int d2 = coords.w;
        int d1 = d2 / ${a};
        int q = d2 - d1 * ${a};
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        //intialize dotProd with a small epsilon seems to reduce GPU accuracy loss.
        vec4 dotProd = vec4(0.000000000000001);

        ${f}

        vec4 result = dotProd - vec4(0.000000000000001);
        ${g}
        ${x}
        setOutput(result);
      }
    `}}});function f7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dilations:c,dimRoundingMode:l}=o,u=c;u==null&&(u=[1,1]),b.assert(k.eitherStridesOrDilationsAreOne(a,u),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${a} and dilations '${u}'`);let p=k.computeConv2DInfo(n.shape,s.shape,a,u,i,l,!0),m;O().getBool("WEBGL_PACK_DEPTHWISECONV")&&p.strideWidth<=2&&p.outChannels/p.inChannels===1?m=new zl(p):m=new Vl(p);let f=[[p.padInfo.top,p.padInfo.left],[p.strideHeight,p.strideWidth],[p.dilationHeight,p.dilationWidth],[p.inHeight,p.inWidth]];return e.runWebGLProgram(m,[n,s],"float32",f)}var RD,AD=h(()=>{I();ev();rv();RD={kernelName:Oi,backendName:"webgl",kernelFunc:f7}});var Th,Ih,ov=h(()=>{Th=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideHeight,o=t.strideWidth,n=t.padInfo.top,s=t.padInfo.left,a=t.outChannels/t.inChannels;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int wR = coords.x;
        int wC = coords.y;
        int d1 = coords.z;
        int dm = coords.w;
        int d2 = d1 * ${a} + dm;

        float dotProd = 0.0;

        // TO DO: Vec4 over the batch size
        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yR = 0; yR < ${t.outHeight}; yR++) {
            int xR = wR + yR * ${e} - ${n};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int yC = 0; yC < ${t.outWidth}; yC++) {
              int xC = wC + yC * ${o} - ${s};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              float dyValue = getDy(b, yR, yC, d2);
              float xValue = getX(b, xR, xC, d1);
              dotProd += (xValue * dyValue);
            }
          }
        }
        setOutput(dotProd);
      }
    `}},Ih=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,a=e-1-t.padInfo.top,i=o-1-t.padInfo.left,c=t.outChannels/t.inChannels;this.userCode=`
      const ivec2 pads = ivec2(${a}, ${i});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[3];
        ivec2 dyCorner = coords.yz - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        float dotProd = 0.0;

        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            int wCPerm = ${o} - 1 - wC;

            // TO DO: Vec4 over the channelMul
            for (int dm = 0; dm < ${c}; dm++) {
              int d2 = d1 * ${c} + dm;
              float xValue = getDy(batch, idyR, idyC, d2);
              float wValue = getW(wRPerm, wCPerm, d1, dm);
              dotProd += xValue * wValue;
            }
          }
        }
        setOutput(dotProd);
      }
    `}}});function d7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,dilations:i,pad:c,dimRoundingMode:l,filterShape:u}=o,p=k.computeConv2DInfo(n.shape,u,a,i,c,l,!0),m=new Th(p);return e.runWebGLProgram(m,[n,s],"float32")}var _D,DD=h(()=>{I();ov();_D={kernelName:Pi,backendName:"webgl",kernelFunc:d7}});function h7(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{strides:a,dilations:i,pad:c,dimRoundingMode:l,inputShape:u}=o,p=k.computeConv2DInfo(u,s.shape,a,i,c,l,!0),m=new Ih(p);return e.runWebGLProgram(m,[n,s],"float32")}var FD,OD=h(()=>{I();ov();FD={kernelName:Li,backendName:"webgl",kernelFunc:h7}});var kh,PD=h(()=>{kh=class{constructor(t){this.variableNames=["X"],this.outputShape=[t,t],this.userCode=`
      void main() {
          ivec2 coords = getOutputCoords();
          float val = coords[0] == coords[1] ? getX(coords[0]) : 0.0;
          setOutput(val);
      }
    `}}});function g7(r){let{inputs:t,backend:e}=r,{x:o}=t,n=[...o.shape,...o.shape],s=b.sizeFromShape(o.shape),a=J({inputs:{x:o},backend:e,attrs:{shape:[s]}}),i=new kh(s),c=e.runWebGLProgram(i,[a],a.dtype),l=J({inputs:{x:c},backend:e,attrs:{shape:n}});return e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(c),l}var LD,MD=h(()=>{I();PD();Xt();LD={kernelName:Mi,backendName:"webgl",kernelFunc:g7}});var Eh,BD=h(()=>{Eh=class{constructor(t){this.variableNames=["x","W"],this.outputShape=t.outShape;let{inHeight:e,inWidth:o,padInfo:n,strideHeight:s,strideWidth:a,filterHeight:i,filterWidth:c,dilationHeight:l,dilationWidth:u}=t,{top:p,left:m}=n;this.userCode=`
      const ivec2 strides = ivec2(${s}, ${a});
      const ivec2 pads = ivec2(${p}, ${m});
      const float neg_infinity = -3.4e38;

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        int d1 = coords.w;
        ivec2 outTopLeftCorner =
            coords.yz * strides - pads;
        int hBeg = outTopLeftCorner.x;
        int wBeg = outTopLeftCorner.y;

        float curVal = neg_infinity;
        for (int h = 0; h < ${i}; h++) {
          int hIn = hBeg + h * ${l};

          if (hIn >= 0 && hIn < ${e}) {
            for (int w = 0; w < ${c}; w++) {
              int wIn = wBeg + w * ${u};

              if (wIn >= 0 && wIn < ${o}) {
                float xVal = getX(batch, hIn, wIn, d1);
                float wVal = getW(h, w, d1);

                float val = xVal + wVal;
                if (val > curVal) {
                  curVal = val;
                }
              }
            }
          }
        }

        float result = curVal;
        setOutput(result);
      }
    `}}});function x7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dilations:c}=o,l=k.computeDilation2DInfo(n.shape,s.shape,a,i,"NHWC",c),u,p=new Eh(l);u=e.runWebGLProgram(p,[n,s],"float32");let m=J({inputs:{x:u},backend:e,attrs:{shape:l.outShape}});return e.disposeIntermediateTensorInfo(u),m}var VD,zD=h(()=>{I();BD();Xt();VD={kernelName:Bi,backendName:"webgl",kernelFunc:x7}});function y7(r){let{inputs:t,backend:e,attrs:o}=r,{equation:n}=o,s=t,{allDims:a,summedDims:i,idDims:c}=k.decodeEinsumEquation(n,s.length);k.checkEinsumDimSizes(a.length,c,s);let{path:l,steps:u}=k.getEinsumComputePath(i,c),p=u.length,m=null,f=a.length,d=[];for(let x=0;x<p;++x){for(let g of u[x]){let{permutationIndices:y,expandDims:v}=k.getEinsumPermutation(f,c[g]),N;k.isIdentityPermutation(y)?N=s[g]:(N=re({inputs:{x:s[g]},backend:e,attrs:{perm:y}}),d.push(N));let S=N.shape.slice();for(let R=0;R<v.length;++R)S.splice(v[R],0,1);b.arraysEqual(N.shape,S)||(N=J({inputs:{x:N},backend:e,attrs:{shape:S}}),d.push(N)),m===null?m=N:(m=fp({inputs:{a:N,b:m},backend:e}),d.push(m))}x<p-1&&(l[x]>=0&&(m=Ja({inputs:{x:m},backend:e,attrs:{axis:l[x]-(a.length-f),keepDims:!1}}),d.push(m)),f--)}for(let x of d)x!==m&&e.disposeIntermediateTensorInfo(x);return m}var GD,WD=h(()=>{I();zd();Xt();hp();Vr();GD={kernelName:Vi,backendName:"webgl",kernelFunc:y7}});var b7,v7,w7,UD,HD=h(()=>{I();wt();b7="return (x >= 0.0) ? x : (exp(x) - 1.0);",v7=`
  vec4 result;

  result.r = (x.r >= 0.0) ? x.r : (exp(x.r) - 1.0);
  result.g = (x.g >= 0.0) ? x.g : (exp(x.g) - 1.0);
  result.b = (x.b >= 0.0) ? x.b : (exp(x.b) - 1.0);
  result.a = (x.a >= 0.0) ? x.a : (exp(x.a) - 1.0);

  return result;
`,w7=pt({opSnippet:b7,packedOpSnippet:v7}),UD={kernelName:"Elu",backendName:"webgl",kernelFunc:w7}});var C7,S7,N7,KD,qD=h(()=>{I();Yo();Mr();C7="return (b >= 0.0) ? a : a * (b + 1.0);",S7=`
  vec4 bGTEZero = vec4(greaterThanEqual(b, vec4(0.)));
  return (bGTEZero * a) + ((vec4(1.0) - bGTEZero) * (a * (b + vec4(1.0))));
`,N7=r=>{let{inputs:t,backend:e}=r,{dy:o,y:n}=t,s=O().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new Pr(S7,o.shape,n.shape):new Cr(C7,o.shape,n.shape);return e.runWebGLProgram(s,[o,n],o.dtype)},KD={kernelName:Kp,backendName:"webgl",kernelFunc:N7}});var T7,I7,k7,XD,jD=h(()=>{I();wt();Nt();T7=`
  return vec4(equal(a, b));
`,I7="return float(a == b);",k7=Wt({opSnippet:I7,packedOpSnippet:T7,dtype:"bool",cpuKernelImpl:Q$}),XD={kernelName:ks,backendName:"webgl",kernelFunc:k7}});var E7,$7,YD,ZD=h(()=>{I();wt();E7=`
  // Error function is calculated approximately with elementary function.
  // See "Handbook of Mathematical Functions with Formulas,
  // Graphs, and Mathematical Tables", Abramowitz and Stegun.
  float p = ${k.ERF_P};
  float a1 = ${k.ERF_A1};
  float a2 = ${k.ERF_A2};
  float a3 = ${k.ERF_A3};
  float a4 = ${k.ERF_A4};
  float a5 = ${k.ERF_A5};

  float sign = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + p * x);
  return sign * (1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*exp(-x*x));
`,$7=pt({opSnippet:E7}),YD={kernelName:"Erf",backendName:"webgl",kernelFunc:$7}});var R7,A7,nv,QD,sv=h(()=>{I();wt();Nt();R7=mo+`
  return exp(x);
`,A7=`
  vec4 result = exp(x);
  bvec4 isNaN = isnan(x);
  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,nv=pt({opSnippet:R7,packedOpSnippet:A7,cpuKernelImpl:J$,dtype:"float32"}),QD={kernelName:"Exp",backendName:"webgl",kernelFunc:nv}});function $h(r){let{inputs:t,attrs:e,backend:o}=r,{dim:n}=e,{input:s}=t,a=s.shape.length,i=s.shape.slice(),c=n;return n<0&&(b.assert(-(a+1)<=n,()=>`Axis must be in the interval [${-(a+1)}, ${a}]`),c=a+n+1),i.splice(c,0,1),J({inputs:{x:s},backend:o,attrs:{shape:i}})}var JD,av=h(()=>{I();Xt();JD={kernelName:zi,backendName:"webgl",kernelFunc:$h}});var tF,_7,eF,rF=h(()=>{I();wt();Nt();tF="return exp(x) - 1.0;",_7=pt({opSnippet:tF,packedOpSnippet:tF,cpuKernelImpl:tR}),eF={kernelName:Es,backendName:"webgl",kernelFunc:_7}});var bp,oF=h(()=>{bp=class{constructor(t,e,o){this.variableNames=["real","imag"];let n=e[1];this.outputShape=e;let s=o?`2.0 * ${Math.PI}`:`-2.0 * ${Math.PI}`,a=o?`${n}.0`:"1.0",i;if(t==="real")i="return real * expR - imag * expI;";else if(t==="imag")i="return real * expI + imag * expR;";else throw new Error(`FFT component must be either "real" or "imag", got ${t}.`);this.userCode=`
      const float exponentMultiplier = ${s};

      float unaryOpComplex(float real, float expR, float imag, float expI) {
        ${i}
      }

      float mulMatDFT(int batch, int index) {
        float indexRatio = float(index) / float(${n});
        float exponentMultiplierTimesIndexRatio =
            exponentMultiplier * indexRatio;

        float result = 0.0;

        for (int i = 0; i < ${n}; i++) {
          // x = (-2|2 * PI / N) * index * i;
          float x = exponentMultiplierTimesIndexRatio * float(i);
          float expR = cos(x);
          float expI = sin(x);
          float real = getReal(batch, i);
          float imag = getImag(batch, i);

          result +=
              unaryOpComplex(real, expR, imag, expI) / ${a};
        }

        return result;
      }

      void main() {
        ivec2 coords = getOutputCoords();
        setOutput(mulMatDFT(coords[0], coords[1]));
      }
    `}}});function Rh(r,t,e){let o=e.texData.get(r.dataId),n=b.sizeFromShape(r.shape),s=r.shape[r.shape.length-1],a=n/s,i=J({inputs:{x:r},backend:e,attrs:{shape:[a,s]}}),c=i.shape,l=new bp("real",c,t),u=new bp("imag",c,t),p=[{dataId:o.complexTensorInfos.real.dataId,dtype:o.complexTensorInfos.real.dtype,shape:c},{dataId:o.complexTensorInfos.imag.dataId,dtype:o.complexTensorInfos.imag.dtype,shape:c}],m=e.runWebGLProgram(l,p,"float32"),f=e.runWebGLProgram(u,p,"float32"),d=Sr({inputs:{real:m,imag:f},backend:e});e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f);let x=J({inputs:{x:d},backend:e,attrs:{shape:r.shape}});return e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(d),x}var iv=h(()=>{I();oF();bn();Xt();});function D7(r){let{inputs:t,backend:e}=r,{input:o}=t;return Rh(o,!1,e)}var nF,sF=h(()=>{I();iv();nF={kernelName:"FFT",backendName:"webgl",kernelFunc:D7}});var Ah,aF=h(()=>{Ah=class{constructor(t,e){this.outputShape=[],this.customUniforms=[{name:"value",type:"float"}],this.variableNames=["x"],this.outputShape=t,this.userCode=`
      void main() {
        // Input can be obtained from uniform value.
        setOutput(value);
      }
    `}}});function Cn(r){let{backend:t,attrs:e}=r,{shape:o,value:n}=e,{dtype:s}=e;if(s=s||b.inferDtype(n),s==="string"){let a=b.getArrayFromDType(s,b.sizeFromShape(o));return a.fill(n),t.makeTensorInfo(o,s,a)}else{let a=new Ah(o,n),i=[[n]];return t.runWebGLProgram(a,[],s,i)}}var iF,Gl=h(()=>{I();aF();iF={kernelName:Gi,backendName:"webgl",kernelFunc:Cn}});var _h,cF=h(()=>{_h=class{constructor(t){this.variableNames=["Image"],this.outputShape=[];let e=t[2];this.outputShape=t,this.userCode=`
        void main() {
          ivec4 coords = getOutputCoords();
          int x = coords[2];

          int coordX = ${e} - x - 1;
          float outputValue;
          if(coordX >= 0 && coordX < ${e}) {
            outputValue = getImage(coords[0], coords[1], coordX, coords[3]);
          } else {
            outputValue = getImage(coords[0], coords[1], coords[2], coords[3]);
          }
          setOutput(outputValue);
        }
    `}}});var lF,uF=h(()=>{I();cF();lF={kernelName:Wi,backendName:"webgl",kernelFunc:({inputs:r,backend:t})=>{let{image:e}=r,o=t,n=new _h(e.shape);return o.runWebGLProgram(n,[e],e.dtype)}}});var pF,F7,mF,fF=h(()=>{I();wt();Nt();pF="return floor(x);",F7=pt({opSnippet:pF,packedOpSnippet:pF,cpuKernelImpl:eR}),mF={kernelName:$s,backendName:"webgl",kernelFunc:F7}});var O7,P7,L7,dF,hF=h(()=>{I();wt();O7=`
  float s = sign(a) * sign(b);
  int ia = round(a);
  int ib = round(b);
  if (ib != 0) {
    // Windows (D3D) wants guaranteed non-zero int division at compile-time.
    return float(idiv(ia, ib, s));
  } else {
    return NAN;
  }
`,P7=`
  ivec4 ia = round(a);
  ivec4 ib = round(b);
  bvec4 cond = notEqual(ib, ivec4(0));
  ivec4 result = ivec4(0);
  vec4 s = sign(a) * sign(b);

  // Windows (D3D) wants guaranteed non-zero int division at compile-time.
  if (cond[0]) {
    result[0] = idiv(ia[0], ib[0], s[0]);
  }
  if (cond[1]) {
    result[1] = idiv(ia[1], ib[1], s[1]);
  }
  if (cond[2]) {
    result[2] = idiv(ia[2], ib[2], s[2]);
  }
  if (cond[3]) {
    result[3] = idiv(ia[3], ib[3], s[3]);
  }
  return vec4(result);
`,L7=Wt({opSnippet:O7,packedOpSnippet:P7,dtype:"int32"}),dF={kernelName:Rs,backendName:"webgl",kernelFunc:L7}});var Dh,gF=h(()=>{io();Dh=class{constructor(t){this.variableNames=["A"];let e=ie(),[o,n]=t;this.outputShape=t,this.userCode=`
      void main() {
        ivec3 coords = getOutputCoords();
        int texR = coords[0];
        int texC = coords[1];
        int depth = coords[2];
        vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${n}.0, ${o}.0);

        vec4 values = ${e.texture2D}(A, uv);
        float value;
        if (depth == 0) {
          value = values.r;
        } else if (depth == 1) {
          value = values.g;
        } else if (depth == 2) {
          value = values.b;
        } else if (depth == 3) {
          value = values.a;
        }

        setOutput(floor(value * 255.0 + 0.5));
      }
    `}}});var Fh,xF=h(()=>{io();Fh=class{constructor(t){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0;let e=ie(),[o,n]=t;this.outputShape=t,this.userCode=`
      void main() {
        ivec3 coords = getOutputCoords();
        int texR = coords[0];
        int texC = coords[1];
        int depth = coords[2];

        vec4 result = vec4(0.);

        for(int row=0; row<=1; row++) {
          for(int col=0; col<=1; col++) {
            texC = coords[1] + row;
            depth = coords[2] + col;

            vec2 uv = (vec2(texC, texR) + halfCR) /
                       vec2(${n}.0, ${o}.0);
            vec4 values = ${e.texture2D}(A, uv);
            float value;
            if (depth == 0) {
              value = values.r;
            } else if (depth == 1) {
              value = values.g;
            } else if (depth == 2) {
              value = values.b;
            } else if (depth == 3) {
              value = values.a;
            }

            result[row * 2 + col] = floor(value * 255.0 + 0.5);
          }
        }

        ${e.output} = result;
      }
    `}}});function M7(r){let{inputs:t,backend:e,attrs:o}=r,{pixels:n}=t,{numChannels:s}=o,a=typeof HTMLVideoElement!="undefined"&&n instanceof HTMLVideoElement,i=typeof HTMLImageElement!="undefined"&&n instanceof HTMLImageElement,[c,l]=a?[n.videoWidth,n.videoHeight]:[n.width,n.height],u=[l,c],p=[l,c,s];if(i||a){let x=O().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU");(Wl==null||x!==cv)&&(cv=x,Wl=document.createElement("canvas").getContext("2d",{willReadFrequently:cv})),Wl.canvas.width=c,Wl.canvas.height=l,Wl.drawImage(n,0,0,c,l),n=Wl.canvas}let m=e.makeTensorInfo(u,"int32");e.texData.get(m.dataId).usage=Ze.PIXELS,e.gpgpu.uploadPixelDataToTexture(e.getTexture(m.dataId),n);let f=O().getBool("WEBGL_PACK")?new Fh(p):new Dh(p),d=e.runWebGLProgram(f,[m],"int32");return e.disposeData(m.dataId),d}var yF,Wl,cv,bF=h(()=>{I();I();ao();gF();xF();yF={kernelName:ou,backendName:"webgl",kernelFunc:M7},cv=O().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU")});function B7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:a,preluActivationWeights:i}=t,{strides:c,pad:l,dataFormat:u,dilations:p,dimRoundingMode:m,activation:f,leakyreluAlpha:d}=o,x=k.convertConv2DDataFormat(u),g=k.computeConv2DInfo(n.shape,s.shape,c,p,l,m,!1,x),y,v=[],N=a!=null,S=i!=null,R=f==="leakyrelu",A=()=>{let D=[n,s],L=(M,V)=>{if(V==="NCHW"&&M.shape.length===1&&M.shape[0]!==1){let W=J({inputs:{x:M},backend:e,attrs:{shape:[M.shape[0],1,1]}});return v.push(W),W}return M};if(N&&D.push(L(a,u)),S&&D.push(L(i,u)),R){let M=e.makeTensorInfo([],"float32",b.createScalarValue(d,"float32"));D.push(M),v.push(M)}return D};if(g.filterHeight===1&&g.filterWidth===1&&g.dilationHeight===1&&g.dilationWidth===1&&g.strideHeight===1&&g.strideWidth===1&&(g.padInfo.type==="SAME"||g.padInfo.type==="VALID"))y=dh({x:n,filter:s,convInfo:g,backend:e,bias:a,activation:f,preluActivationWeights:i,leakyreluAlpha:d});else if(g.strideWidth<=2&&x==="channelsLast"&&O().getBool("WEBGL_EXP_CONV")){let D=f?vn(f,!0):null,L=new Bl(g,N,D,S,R),M=[[g.padInfo.top,g.padInfo.left],[g.strideHeight,g.strideWidth],[g.dilationHeight,g.dilationWidth],[g.inHeight,g.inWidth]],V=A();y=e.runWebGLProgram(L,V,"float32",M)}else if(O().getBool("WEBGL_CONV_IM2COL"))y=hh({x:n,filter:s,convInfo:g,backend:e,bias:a,activation:f,preluActivationWeights:i,leakyreluAlpha:d});else{let D=f?vn(f,!1):null,L=new Ml(g,N,D,S,R),M=A();y=e.runWebGLProgram(L,M,"float32")}let _=J({inputs:{x:y},backend:e,attrs:{shape:g.outShape}});return v.push(y),v.forEach(D=>e.disposeIntermediateTensorInfo(D)),_}var vF,wF=h(()=>{I();ph();Q0();wt();J0();Xt();vF={kernelName:ca,backendName:"webgl",kernelFunc:B7}});function V7(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:a,preluActivationWeights:i}=t,{strides:c,pad:l,dilations:u,dimRoundingMode:p,activation:m,leakyreluAlpha:f}=o,d=[],x=u;x==null&&(x=[1,1]),b.assert(k.eitherStridesOrDilationsAreOne(c,x),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${c} and dilations '${x}'`);let g=k.computeConv2DInfo(n.shape,s.shape,c,x,l,p,!0),y=O().getBool("WEBGL_PACK_DEPTHWISECONV")&&g.strideWidth<=2&&g.outChannels/g.inChannels===1,v=m?vn(m,y):null,N=[n,s],S=a!=null,R=i!=null,A=m==="leakyrelu";if(S&&N.push(a),R&&N.push(i),A){let M=e.makeTensorInfo([],"float32",b.createScalarValue(f,"float32"));N.push(M),d.push(M)}let _;y?_=new zl(g,S,v,R,A):_=new Vl(g,S,v,R,A);let D=[[g.padInfo.top,g.padInfo.left],[g.strideHeight,g.strideWidth],[g.dilationHeight,g.dilationWidth],[g.inHeight,g.inWidth]],L=e.runWebGLProgram(_,N,"float32",D);return d.forEach(M=>e.disposeIntermediateTensorInfo(M)),L}var CF,SF=h(()=>{I();ev();rv();wt();CF={kernelName:la,backendName:"webgl",kernelFunc:V7}});var Oh,NF=h(()=>{de();Oh=class{constructor(t,e,o,n){this.sliceDim=t,this.strides=e,this.paramsShape=n,this.variableNames=["x","indices"],this.outputShape=o;let s=St(o.length),a=`
    int index;`;for(let i=0;i<this.sliceDim;i++)a+=`
          index = round(getIndices(coords[0], ${i}));
          out_of_bounds = out_of_bounds || index < 0;
          out_of_bounds = out_of_bounds || index >= ${this.paramsShape[i]};
          flattenIndex += index * ${this.strides[i]};`;this.userCode=`
         void main() {
          ${s} coords = getOutputCoords();
          int flattenIndex = 0;
          bool out_of_bounds = false;

          ${a}

          setOutput(out_of_bounds ? 0.0 : getX(flattenIndex, coords[1]));
        }
      `}}});function z7(r){let{inputs:t,backend:e}=r,{params:o,indices:n}=t,s=n.shape,a=s[s.length-1],i=b.sizeFromShape(o.shape),[c,l,u,p]=k.prepareAndValidate(o,n),m=J({inputs:{x:n},backend:e,attrs:{shape:[l,a]}}),f=J({inputs:{x:o},backend:e,attrs:{shape:[b.sizeFromShape(o.shape)/u,u]}});if(e.shouldExecuteOnCPU([o,n])||o.dtype==="string"){let y=e.readSync(n.dataId),v=e.bufferSync(o),N=rR(y,v,o.dtype,l,a,u,p,o.shape,i);return e.makeTensorInfo(c,o.dtype,N.values)}let d=new Oh(a,p,[l,u],o.shape),x=e.runWebGLProgram(d,[f,m],f.dtype),g=J({inputs:{x},backend:e,attrs:{shape:c}});return e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(x),g}var TF,IF=h(()=>{I();NF();Nt();Xt();TF={kernelName:Ki,backendName:"webgl",kernelFunc:z7}});function G7(r,t){let e=["resRC.x","resRC.y","resRC.z","resRC.w"],o=[];for(let n=0;n<r.length;n++)n===2?o.push("index"):o.push(`${e[n]}`);return o.join()}var Ph,kF=h(()=>{de();Ph=class{constructor(t,e){this.variableNames=["A","indices"],this.outputShape=e,this.rank=e.length;let o=St(this.rank),n=G7(t,2);this.userCode=`
      void main() {
        ${o} resRC = getOutputCoords();
        int index = int(getIndices(resRC.x, resRC.z));
        float inBounds = (index >= 0) && (index < ${t[2]}) ? 1.0 : 0.0;
        setOutput(inBounds * getA(${n}));
      }
    `}}});function lv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,indices:s}=t,{axis:a,batchDims:i}=o,c=b.parseAxisParam(a,n.shape)[0];if(O().get("DEBUG")){let v=e.readSync(s.dataId),N=n.shape[c];for(let S=0;S<v.length;++S){let R=v[S];b.assert(R<=N-1&&R>=0,()=>`GatherV2: the index value ${R} is not in [0, ${N-1}]`)}}let l=k.segment_util.collectGatherOpShapeInfo(n,s,c,i),u=b.sizeFromShape(s.shape),p=[],m=J({inputs:{x:n},backend:e,attrs:{shape:[l.batchSize,l.outerSize,l.dimSize,l.sliceSize]}}),f=J({inputs:{x:s},backend:e,attrs:{shape:[l.batchSize,u/l.batchSize]}});p.push(m),p.push(f);let d=[l.batchSize,l.outerSize,u/l.batchSize,l.sliceSize];if(e.shouldExecuteOnCPU([n,s])||n.dtype==="string"){let v=e.bufferSync(f),N=e.bufferSync(m),S=oR(N,v,d);return p.forEach(R=>e.disposeIntermediateTensorInfo(R)),e.makeTensorInfo(l.outputShape,S.dtype,S.values)}let x=new Ph(m.shape,d),g=e.runWebGLProgram(x,[m,f],m.dtype);p.push(g);let y=J({inputs:{x:g},backend:e,attrs:{shape:l.outputShape}});return p.forEach(v=>e.disposeIntermediateTensorInfo(v)),y}var EF,uv=h(()=>{I();kF();Nt();Xt();EF={kernelName:Hi,backendName:"webgl",kernelFunc:lv}});var W7,U7,H7,$F,RF=h(()=>{I();wt();Nt();W7="return float(a > b);",U7=`
  return vec4(greaterThan(a, b));
`,H7=Wt({opSnippet:W7,packedOpSnippet:U7,cpuKernelImpl:nR,dtype:"bool"}),$F={kernelName:As,backendName:"webgl",kernelFunc:H7}});var K7,q7,X7,AF,_F=h(()=>{I();wt();Nt();K7="return float(a >= b);",q7=`
  return vec4(greaterThanEqual(a, b));
`,X7=Wt({opSnippet:K7,packedOpSnippet:q7,dtype:"bool",cpuKernelImpl:sR}),AF={kernelName:_s,backendName:"webgl",kernelFunc:X7}});function j7(r){let{inputs:t,backend:e}=r,{input:o}=t;return Rh(o,!0,e)}var DF,FF=h(()=>{I();iv();DF={kernelName:qi,backendName:"webgl",kernelFunc:j7}});var Y7,Z7,OF,PF=h(()=>{I();wt();Y7="return float(!isnan(x) && !isinf(x));",Z7=pt({opSnippet:Y7,dtype:"bool"}),OF={kernelName:Ds,backendName:"webgl",kernelFunc:Z7}});var Q7,J7,LF,MF=h(()=>{I();wt();Q7="return float(isinf(x));",J7=pt({opSnippet:Q7,dtype:"bool"}),LF={kernelName:Fs,backendName:"webgl",kernelFunc:J7}});var tZ,eZ,BF,VF=h(()=>{I();wt();tZ="return float(isnan(x));",eZ=pt({opSnippet:tZ,dtype:"bool"}),BF={kernelName:Os,backendName:"webgl",kernelFunc:eZ}});var rZ,oZ,nZ,zF,GF=h(()=>{I();wt();Nt();rZ="return float(a < b);",oZ=`
  return vec4(lessThan(a, b));
`,nZ=Wt({opSnippet:rZ,packedOpSnippet:oZ,cpuKernelImpl:aR,dtype:"bool"}),zF={kernelName:Ps,backendName:"webgl",kernelFunc:nZ}});var sZ,aZ,iZ,WF,UF=h(()=>{I();wt();Nt();sZ="return float(a <= b);",aZ=`
  return vec4(lessThanEqual(a, b));
`,iZ=Wt({opSnippet:sZ,packedOpSnippet:aZ,cpuKernelImpl:iR,dtype:"bool"}),WF={kernelName:Ls,backendName:"webgl",kernelFunc:iZ}});function cZ(r){let{backend:t,attrs:e}=r,{start:o,stop:n,num:s}=e,a=cR(o,n,s);return t.makeTensorInfo([a.length],"float32",a)}var HF,KF=h(()=>{I();Nt();HF={kernelName:Yi,backendName:"webgl",kernelFunc:cZ}});var lZ,uZ,pZ,qF,XF=h(()=>{I();wt();Nt();lZ=mo+`
  return x < 0.0 ? 0./0. : log(x);
`,uZ=`
  vec4 result = log(x);
  bvec4 isNaN = isnan(x);
  result.r = isNaN.r ? x.r : (x.r < 0.0 ? 0./0. : result.r);
  result.g = isNaN.g ? x.g : (x.g < 0.0 ? 0./0. : result.g);
  result.b = isNaN.b ? x.b : (x.b < 0.0 ? 0./0. : result.b);
  result.a = isNaN.a ? x.a : (x.a < 0.0 ? 0./0. : result.a);
  return result;
`,pZ=pt({opSnippet:lZ,packedOpSnippet:uZ,cpuKernelImpl:lR}),qF={kernelName:"Log",backendName:"webgl",kernelFunc:pZ}});var mZ,fZ,jF,YF=h(()=>{I();wt();mZ=mo+`
  return log(1.0 + x);
`,fZ=pt({opSnippet:mZ}),jF={kernelName:Ms,backendName:"webgl",kernelFunc:fZ}});var dZ,hZ,gZ,ZF,QF=h(()=>{I();wt();dZ="return float(a >= 1.0 && b >= 1.0);",hZ=`
  return vec4(
    vec4(greaterThanEqual(a, vec4(1.0))) *
    vec4(greaterThanEqual(b, vec4(1.0))));
`,gZ=Wt({opSnippet:dZ,packedOpSnippet:hZ,dtype:"bool"}),ZF={kernelName:Bs,backendName:"webgl",kernelFunc:gZ}});var xZ,yZ,JF,tO=h(()=>{I();wt();xZ="return float(!(x >= 1.0));",yZ=pt({opSnippet:xZ}),JF={kernelName:Vs,backendName:"webgl",kernelFunc:yZ}});var bZ,vZ,wZ,eO,rO=h(()=>{I();wt();bZ="return float(a >= 1.0 || b >= 1.0);",vZ=`
  return min(
    vec4(greaterThanEqual(a, vec4(1.0))) +
    vec4(greaterThanEqual(b, vec4(1.0))),
    vec4(1.0));
`,wZ=Wt({opSnippet:bZ,packedOpSnippet:vZ,dtype:"bool"}),eO={kernelName:zs,backendName:"webgl",kernelFunc:wZ}});var Lh,oO=h(()=>{Lh=class{constructor(t,e,o,n,s){this.variableNames=["x"],this.outputShape=[];let a=e,i=t[3]-1;this.outputShape=t;let c,l=`float(${o}) + float(${n}) * sum`;s===.5?c=`inversesqrt(${l})`:s===1?c=`1.0/(${l})`:c=`exp(log(${l}) * float(-${s}));`,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int r = coords[1];
        int c = coords[2];
        int d = coords[3];
        float x = getX(b, r, c, d);
        float sum = 0.0;
        for (int j = -${a}; j <= ${a}; j++) {
          int idx = d + j;
          if (idx >= 0 && idx <=  ${i}) {
            float z = getX(b, r, c, idx);
            sum += z * z;
          }
        }
        float val = x * ${c};
        setOutput(val);
      }
    `}}});var Mh,nO=h(()=>{Mh=class{constructor(t,e,o,n,s){this.variableNames=["x"],this.outputShape=[],this.packedInputs=!0,this.packedOutput=!0;let a=e,i=t[3]-1;this.outputShape=t;let c,l=`float(${o}) + float(${n}) * sum`;s===.5?c=`inversesqrt(${l})`:s===1?c=`1.0/(${l})`:c=`exp(log(${l}) * float(-${s}));`,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords.x;
        int r = coords.y;
        int c = coords.z;
        int d = coords.w;

        bool hasNextCol = d < ${this.outputShape[3]};
        bool hasNextRow = c < ${this.outputShape[2]};

        vec4 sum = vec4(0.);
        vec4 xFragAtOutputCoords = getX(b, r, c, d);

        vec4 xAtOutputCoords = vec4(
          getChannel(xFragAtOutputCoords, vec2(c, d)),
          hasNextCol ?
            getChannel(xFragAtOutputCoords, vec2(c, d + 1)) : 0.0,
          hasNextRow ?
            getChannel(xFragAtOutputCoords , vec2(c + 1, d)) : 0.0,
          (hasNextRow && hasNextCol) ?
            getChannel(xFragAtOutputCoords, vec2(c + 1, d + 1)) : 0.0
        );

        int firstChannel = d - ${a};
        vec2 cache = vec2(0.);
        if(firstChannel >= 0){
          vec4 firstChannelFrag = getX(b, r, c, firstChannel);
          cache.x = getChannel(firstChannelFrag, vec2(c, firstChannel));
            if(hasNextRow){
              cache.y = getChannel(firstChannelFrag, vec2(c + 1, firstChannel));
            }
        }

        ivec2 depth = ivec2(d, d + 1);
        for (int j = - ${a}; j <= ${a}; j++) {
          ivec2 idx = depth + j;
          bvec2 aboveLowerBound = greaterThanEqual(idx, ivec2(0));
          bvec2 belowUpperBound = lessThanEqual(idx, ivec2(${i}));

          bool depthInRange = aboveLowerBound.x && belowUpperBound.x;
          bool depthPlusOneInRange = aboveLowerBound.y && belowUpperBound.y;

          if(depthInRange || depthPlusOneInRange){
            vec4 z = vec4(0.);
            vec4 xFragAtCurrentDepth;
            z.xz = cache.xy;
            if(depthPlusOneInRange && hasNextCol){
              xFragAtCurrentDepth = idx.y != d ?
                getX(b, r, c, idx.y) : xFragAtOutputCoords;
              z.y = getChannel(xFragAtCurrentDepth, vec2(c, idx.y));
              if(hasNextRow){
                z.w = getChannel(xFragAtCurrentDepth, vec2(c + 1, idx.y));
              }
            }
            cache.xy = z.yw;
            sum += z * z;
          }
        }
        vec4 result = xAtOutputCoords * ${c};
        setOutput(result);
      }
    `}}});var CZ,sO,aO=h(()=>{I();oO();nO();CZ=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{depthRadius:s,bias:a,alpha:i,beta:c}=o,l=O().getBool("WEBGL_PACK_NORMALIZATION")?new Mh(n.shape,s,a,i,c):new Lh(n.shape,s,a,i,c);return e.runWebGLProgram(l,[n],n.dtype)},sO={kernelName:"LRN",backendName:"webgl",kernelFunc:CZ}});var Bh,iO=h(()=>{Bh=class{constructor(t,e,o,n,s){this.variableNames=["inputImage","outputImage","dy"],this.outputShape=[],this.outputShape=t,this.depth=t[3],this.depthRadius=e,this.bias=o,this.alpha=n,this.beta=s,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int r = coords[1];
        int c = coords[2];

        float result = 0.0;
        for (int d = 0; d < ${this.depth}; ++d) {
          int depthBegin = int(max(0.0, float(d - ${e})));
          int depthEnd = int(min(float(${this.depth}),
              float(d + ${e} + 1)));

          const int MIN_DEPTH_BEGIN = 0;
          const int MAX_DEPTH_END = ${this.depth};

          float norm = 0.0;
          for (int k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; ++k) {
            if (k < depthBegin){
              continue;
            }
            else if (k >= depthBegin && k < depthEnd) {
              norm += getInputImage(b, r, c, k) * getInputImage(b, r, c, k);
            }
            else {
              break;
            }
          }

          norm = float(${n}) * norm + float(${o});

          for(int k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; ++k){
            if (k < depthBegin){
              continue;
            }
            else if (k >= depthBegin && k < depthEnd){
              float dyi = -2.0 * float(${n})
                * float(${s})
                * getInputImage(b, r, c, k) * getOutputImage(b, r, c, d)
                / norm;
              if (k == d) {
                dyi += pow(norm, -1.0 * ${s});
              }
              if (k == coords[3]) {
                dyi *= getDy(b, r, c, d);
                result += dyi;
              }
            }
            else {
              break;
            }
          }
      }
      setOutput(result);
      }
    `}}});var SZ,cO,lO=h(()=>{I();iO();SZ=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n,y:s,dy:a}=t,{depthRadius:i,bias:c,alpha:l,beta:u}=o,p=new Bh(n.shape,i,c,l,u);return e.runWebGLProgram(p,[n,s,a],n.dtype)},cO={kernelName:qp,backendName:"webgl",kernelFunc:SZ}});function uO(r,t,e,o){let n=b.sizeFromShape(t),a=b.sizeFromShape(r.shape)/n,i=J({inputs:{x:r},attrs:{shape:[a,n]},backend:o}),c=Br(i,r.dtype,"max",o),l=J({inputs:{x:c},attrs:{shape:e},backend:o});return o.disposeIntermediateTensorInfo(i),o.disposeIntermediateTensorInfo(c),l}var pO=h(()=>{I();es();Xt();});function pv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reductionIndices:s,keepDims:a}=o,i=n.shape.length,c=b.parseAxisParam(s,n.shape),l=c,u=k.getAxesPermutation(l,i),p=u!=null,m=e.shouldExecuteOnCPU([n]),f=n;if(p){if(m){let N=e.texData.get(f.dataId).values,S=new Array(i);for(let _=0;_<S.length;_++)S[_]=n.shape[u[_]];let R=Za(N,n.shape,n.dtype,u,S);f=e.makeTensorInfo(S,n.dtype);let A=e.texData.get(f.dataId);A.values=R}else f=rs(n,u,e);l=k.getInnerMostAxes(l.length,i)}k.assertAxesAreInnerMostDims("max",l,i);let[d,x]=k.computeOutAndReduceShapes(f.shape,l),g=d;a&&(g=k.expandShapeToKeepDim(d,c));let y;if(m){let N=e.texData.get(f.dataId).values,S=uR(N,b.sizeFromShape(x),g,n.dtype);y=e.makeTensorInfo(g,n.dtype);let R=e.texData.get(y.dataId);R.values=S}else y=uO(f,x,g,e);return p&&e.disposeIntermediateTensorInfo(f),y}var mO,mv=h(()=>{I();I();Nt();pO();Ol();mO={kernelName:"Max",backendName:"webgl",kernelFunc:pv}});var NZ,TZ,IZ,fO,dO=h(()=>{I();Yo();Mr();wt();Nt();NZ=Dl+`
  return max(a, b);
`,TZ=`
  vec4 result = vec4(max(a, b));
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+Lr+`
  return result;
`,IZ=Wt({opSnippet:NZ,packedOpSnippet:TZ,cpuKernelImpl:pR}),fO={kernelName:Gs,backendName:"webgl",kernelFunc:IZ}});function kZ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;Ko(n,"maxPool");let{filterSize:s,strides:a,pad:i,dimRoundingMode:c}=o,l=1;b.assert(k.eitherStridesOrDilationsAreOne(a,l),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${a} and dilations '${l}'`);let u=k.computePool2DInfo(n.shape,s,a,l,i,c);if(u.filterWidth===1&&u.filterHeight===1&&b.arraysEqual(u.inShape,u.outShape))return ge({inputs:{x:n},backend:e});let p=new To(u,"max",!1);return e.runWebGLProgram(p,[n],n.dtype)}var hO,gO=h(()=>{I();ns();Fr();Qr();hO={kernelName:Zi,backendName:"webgl",kernelFunc:kZ}});function EZ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:a,pad:i,dataFormat:c,dimRoundingMode:l}=o,u=[1,1,1],p=k.computePool3DInfo(n.shape,s,a,u,i,l,c),m=new os(p,"max",!1);return e.runWebGLProgram(m,[n],n.dtype)}var xO,yO=h(()=>{I();ns();xO={kernelName:Qi,backendName:"webgl",kernelFunc:EZ}});var Vh,zh,fv=h(()=>{Vh=class{constructor(t){this.variableNames=["dy","maxPos"],this.outputShape=t.inShape;let e=t.strideHeight,o=t.strideWidth,n=t.dilationHeight,s=t.effectiveFilterHeight,a=t.effectiveFilterWidth,i=s-1-t.padInfo.top,c=a-1-t.padInfo.left,l=s*a-1;this.userCode=`
      const ivec2 pads = ivec2(${i}, ${c});

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];

        ivec2 dyRCCorner = coords.yz - pads;
        int dyRCorner = dyRCCorner.x;
        int dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${s};
          wR += ${n}) {
          float dyR = float(dyRCorner + wR) / ${e}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          for (int wC = 0; wC < ${a}; wC++) {
            float dyC = float(dyCCorner + wC) / ${o}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            float dyValue = getDy(b, idyR, idyC, d);
            int maxPosValue = ${l} - int(getMaxPos(b, idyR, idyC, d));

            // Get the current value, check it against the value from the
            // position matrix.
            int curPosValue = wR * ${a} + wC;
            float mask = float(maxPosValue == curPosValue ? 1.0 : 0.0);

            dotProd += dyValue * mask;
          }
        }
        setOutput(dotProd);
      }
    `}},zh=class{constructor(t){this.variableNames=["dy","maxPos"],this.outputShape=t.inShape;let e=t.strideDepth,o=t.strideHeight,n=t.strideWidth,s=t.dilationDepth,a=t.dilationHeight,i=t.dilationWidth,c=t.effectiveFilterDepth,l=t.effectiveFilterHeight,u=t.effectiveFilterWidth,p=c-1-t.padInfo.front,m=l-1-t.padInfo.top,f=u-1-t.padInfo.left,d=c*l*u-1;this.userCode=`
      const ivec3 pads = ivec3(${p}, ${m}, ${f});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyDCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, ch) with pos mask(:, :, :, d) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int wD = 0; wD < ${c};
           wD += ${s}) {
          float dyD = float(dyDCorner + wD) / ${e}.0;

          if (dyD < 0.0 || dyD >= ${t.outDepth}.0 || fract(dyD) > 0.0) {
            continue;
          }
          int idyD = int(dyD);

          for (int wR = 0; wR < ${l};
              wR += ${a}) {
            float dyR = float(dyRCorner + wR) / ${o}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
                fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            for (int wC = 0; wC < ${u};
                wC += ${i}) {
              float dyC = float(dyCCorner + wC) / ${n}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              float dyValue = getDy(batch, idyD, idyR, idyC, ch);
              int maxPosValue = ${d} -
                  int(getMaxPos(batch, idyD, idyR, idyC, ch));

              // Get the current value, check it against the value from the
              // position matrix.
              int curPosValue =
                  wD * ${l} * ${u} +
                  wR * ${u} + wC;
              float mask = float(maxPosValue == curPosValue ? 1.0 : 0.0);

              dotProd += dyValue * mask;
            }
          }
        }
        setOutput(dotProd);
      }
    `}}});function $Z(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,a=s,{filterSize:i,strides:c,pad:l,dimRoundingMode:u}=o,p=[1,1,1],m=k.computePool3DInfo(a.shape,i,c,p,l,u),f=new os(m,"max",!0),d=e.runWebGLProgram(f,[a],a.dtype),x=new zh(m),g=e.runWebGLProgram(x,[n,d],a.dtype);return e.disposeIntermediateTensorInfo(d),g}var bO,vO=h(()=>{I();fv();ns();bO={kernelName:jp,backendName:"webgl",kernelFunc:$Z}});function RZ(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s,output:a}=t,i=s;Ko([s,a],"maxPoolGrad");let{filterSize:c,strides:l,pad:u,dimRoundingMode:p}=o,m=k.computePool2DInfo(i.shape,c,l,1,u,p),f=!0,d=new To(m,"max",f),x=e.runWebGLProgram(d,[i],i.dtype),g=new Vh(m),y=e.runWebGLProgram(g,[n,x],i.dtype);return e.disposeIntermediateTensorInfo(x),y}var wO,CO=h(()=>{I();fv();ns();Fr();wO={kernelName:Xp,backendName:"webgl",kernelFunc:RZ}});function SO(r,t,e,o){let n=new To(e,"max",!1),s=o.runWebGLProgram(n,[r],"float32");n=new To(e,"max",!0,!0,t);let a=o.runWebGLProgram(n,[r],"float32");return[s,a]}var NO=h(()=>{ns();});var TO,IO=h(()=>{I();I();NO();TO={kernelName:Ji,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{x:o}=r,{filterSize:n,strides:s,pad:a,includeBatchInIndex:i}=t,c=e;b.assert(o.shape.length===4,()=>`Error in maxPool: input must be rank 4 but got rank ${o.shape.length}.`);let l=[1,1];b.assert(k.eitherStridesOrDilationsAreOne(s,l),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${s} and dilations '${l}'`);let u=k.computePool2DInfo(o.shape,n,s,l,a),[p,m]=SO(o,i,u,c);return[p,m]}}});function kO(r,t,e,o){let n=b.sizeFromShape(t),a=b.sizeFromShape(r.shape)/n,i=J({inputs:{x:r},attrs:{shape:[a,n]},backend:o}),c=Br(i,"float32","mean",o),l=J({inputs:{x:c},attrs:{shape:e},backend:o});return o.disposeIntermediateTensorInfo(i),o.disposeIntermediateTensorInfo(c),l}var EO=h(()=>{I();es();Xt();});var $O,RO=h(()=>{I();EO();Ol();$O={kernelName:tc,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{x:o}=r,{keepDims:n,axis:s}=t,a=e,i=o.shape.length,c=b.parseAxisParam(s,o.shape),l=c,u=k.getAxesPermutation(l,i),p=u!=null,m=a.shouldExecuteOnCPU([o]),f=[],d=o;if(p){if(m){let S=a.texData.get(d.dataId).values,R=new Array(i);for(let D=0;D<R.length;D++)R[D]=o.shape[u[D]];let A=Za(S,o.shape,o.dtype,u,R);d=a.makeTensorInfo(R,o.dtype);let _=a.texData.get(d.dataId);_.values=A}else d=rs(o,u,a);f.push(d),l=k.getInnerMostAxes(l.length,i)}k.assertAxesAreInnerMostDims("sum",l,i);let[x,g]=k.computeOutAndReduceShapes(d.shape,l),y=x;n&&(y=k.expandShapeToKeepDim(x,c));let v=kO(d,g,y,a);for(let N of f)a.disposeIntermediateTensorInfo(N);return v}}});function AZ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o,i=n.shape.length,c=b.parseAxisParam(s,n.shape),l=c,u=k.getAxesPermutation(l,i),p=n;u!=null&&(p=re({inputs:{x:n},backend:e,attrs:{perm:u}}),l=k.getInnerMostAxes(l.length,n.shape.length)),k.assertAxesAreInnerMostDims("min",l,i);let[m,f]=k.computeOutAndReduceShapes(p.shape,l),d=b.sizeFromShape(f),x=J({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=Br(x,x.dtype,"min",e),y;if(a){let v=k.expandShapeToKeepDim(m,c);y=J({inputs:{x:g},backend:e,attrs:{shape:v}})}else y=J({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),y}var AO,_O=h(()=>{I();es();Xt();Vr();AO={kernelName:"Min",backendName:"webgl",kernelFunc:AZ}});var _Z,DZ,FZ,DO,FO=h(()=>{I();Yo();Mr();wt();Nt();_Z=Dl+`
  return min(a, b);
`,DZ=`
  vec4 result = vec4(min(a, b));
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+Lr+`
  return result;
`,FZ=Wt({opSnippet:_Z,packedOpSnippet:DZ,cpuKernelImpl:mR}),DO={kernelName:Ws,backendName:"webgl",kernelFunc:FZ}});var Gh,OO=h(()=>{de();Gh=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=e.map((u,p)=>u[0]+t[p]+u[1]);let n=t.length,s=St(n),a=e.map(u=>u[0]).join(","),i=e.map((u,p)=>u[0]+t[p]).join(","),c=["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,n),l=o==="reflect"?0:1;if(n===1){this.userCode=`
        int start = ${a};
        int end = ${i};

        void main() {
          int outC = getOutputCoords();
          if (outC < start) {
            outC = start * 2 - outC - ${l};
          } else if(outC >= end) {
            outC = (end - 1) * 2 - outC + ${l};
          }
          setOutput(getX(outC - start));
        }
      `;return}this.userCode=`
      ${s} start = ${s}(${a});
      ${s} end = ${s}(${i});

      void main() {
        ${s} outC = getOutputCoords();
        for (int i = 0; i < ${n}; i++) {
          if (outC[i] < start[i]) {
            outC[i] = start[i] * 2 - outC[i] - ${l};
          } else if(outC[i] >= end[i]) {
            outC[i] = (end[i] - 1) * 2 - outC[i] + ${l};
          }
        }
        ${s} coords = outC - start;
        setOutput(getX(${c}));
      }
    `}}});var Wh,PO=h(()=>{No();de();Wh=class{constructor(t,e,o){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=e.map((d,x)=>d[0]+t[x]+d[1]);let n=t.length,s=St(n),a=e.map(d=>d[0]).join(","),i=e.map((d,x)=>d[0]+t[x]).join(","),c=he("rc",n),l=he("source",n),u=`${c[n-1]} < ${this.outputShape[n-1]}`,p=n===1?"source":`vec2(${l.slice(-2).join()})`,m=o==="reflect"?0:1,f="";if(n===1){let d=`
        ${s} source = rc;
        if (source < start) {
          source = start * 2 - source - ${m};
        } else if (source >= end) {
          source = (end - 1) * 2 - source + ${m};
        }
        source -= start;
      `;f=`
        ${s} rc = outputLoc;
        ${d}
        result[0] = getChannel(getX(${l.join()}), ${p});
        ${c[n-1]} += 1;
        if(${u}) {
          ${d}
          result[1] = getChannel(getX(${l.join()}), ${p});
        }
      `}else{let d=`
        ${s} source = rc;
        ${s} lt = ${s}(lessThan(source, start));
        ${s} gte = ${s}(greaterThanEqual(source, end));
        ${s} orig = 1 - (lt + gte);
        source = orig * source +
                lt * (start * 2 - source - ${m}) +
                gte * ((end - 1) * 2 - source + ${m});
        source -= start;
      `;f=`
        ${s} rc = outputLoc;
        ${d}
        result[0] = getChannel(getX(${l.join()}), ${p});
        ${c[n-1]} += 1;
        if(${u}) {
          ${d}
          result[1] = getChannel(getX(${l.join()}), ${p});
        }
        rc = outputLoc;
        ${c[n-2]} += 1;
        if(${c[n-2]} < ${this.outputShape[n-2]}) {
          ${d}
          result[2] = getChannel(getX(${l.join()}), ${p});
          ${c[n-1]} += 1;
          if(${u}) {
            ${d}
            result[3] = getChannel(getX(${l.join()}), ${p});
          }
        }
      `}this.userCode=`
      const ${s} start = ${s}(${a});
      const ${s} end = ${s}(${i});

      void main() {
        ${s} outputLoc = getOutputCoords();
        vec4 result = vec4(0.);
        ${f}
        setOutput(result);
      }
    `}}});var OZ,LO,MO=h(()=>{I();OO();PO();OZ=({inputs:r,backend:t,attrs:e})=>{let{x:o}=r,{paddings:n,mode:s}=e,a=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new Wh(o.shape,n,s):new Gh(o.shape,n,s);return t.runWebGLProgram(a,[o],o.dtype)},LO={kernelName:ec,backendName:"webgl",kernelFunc:OZ}});var PZ,LZ,MZ,BO,VO=h(()=>{I();Mr();wt();PZ=`if (b == 0.0) return NAN;
  return mod(a, b);`,LZ=`
  vec4 result = mod(a, b);
  bvec4 isNaN = equal(b, vec4(0.0));
  `+Lr+`
  return result;
`,MZ=Wt({opSnippet:PZ,packedOpSnippet:LZ}),BO={kernelName:"Mod",backendName:"webgl",kernelFunc:MZ}});var Uh,zO=h(()=>{Uh=class{constructor(t,e,o){this.variableNames=["probs"],this.customUniforms=[{name:"seed",type:"float"}],this.outputShape=[t,o],this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];

        float r = random(seed);
        float cdf = 0.0;

        for (int i = 0; i < ${e-1}; i++) {
          cdf += getProbs(batch, i);

          if (r < cdf) {
            setOutput(float(i));
            return;
          }
        }

        // If no other event happened, last event happened.
        setOutput(float(${e-1}));
      }
    `}}});var BZ,VZ,dv,GO,hv=h(()=>{I();wt();BZ=`
if (a == b) {
  return 1.0;
};
return a / b;`,VZ=`
  // vec4 one = vec4(equal(a, b));
  // return one + (vec4(1.0) - one) * a / b;
  vec4 result = a / b;
  if(a.x == b.x) {
    result.x = 1.;
  }
  if(a.y == b.y) {
    result.y = 1.;
  }
  if(a.z == b.z) {
    result.z = 1.;
  }
  if(a.w == b.w) {
    result.w = 1.;
  }

  return result;
`,dv=Wt({opSnippet:BZ,packedOpSnippet:VZ,checkOutOfBounds:!0}),GO={kernelName:Is,backendName:"webgl",kernelFunc:dv}});var WO,gv,UO,xv=h(()=>{I();wt();Nt();WO="return a - b;",gv=Wt({opSnippet:WO,packedOpSnippet:WO,supportsComplex:!0,cpuKernelImpl:DR}),UO={kernelName:"Sub",backendName:"webgl",kernelFunc:gv}});function yv(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{dim:s}=o,a=b.parseAxisParam([s],n.shape),i=pv({inputs:{x:n},backend:e,attrs:{reductionIndices:a,keepDims:!1}}),c=k.expandShapeToKeepDim(i.shape,a),l=J({inputs:{x:i},backend:e,attrs:{shape:c}}),u=gv({inputs:{a:n,b:l},backend:e}),p=nv({inputs:{x:u},backend:e}),m=Ja({inputs:{x:p},backend:e,attrs:{axis:a,keepDims:!1}}),f=J({inputs:{x:m},backend:e,attrs:{shape:c}}),d=dv({inputs:{a:p,b:f},backend:e});return e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(l),e.disposeIntermediateTensorInfo(u),e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),d}var HO,bv=h(()=>{I();sv();mv();hv();Xt();xv();hp();HO={kernelName:Ec,backendName:"webgl",kernelFunc:yv}});function zZ(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{numSamples:s,seed:a,normalized:i}=o,c=i?n:yv({inputs:{logits:n},backend:e,attrs:{dim:n.shape.length-1}}),l=c.shape[0],u=c.shape[1],p=new Uh(l,u,s),m=[[a]],f=e.runWebGLProgram(p,[c],"int32",m);return i||e.disposeIntermediateTensorInfo(c),f}var KO,qO=h(()=>{I();zO();bv();KO={kernelName:rc,backendName:"webgl",kernelFunc:zZ}});function UZ(r){let{inputs:t,backend:e}=r,{x:o}=t;if(e.shouldExecuteOnCPU([o])){let s=e.texData.get(o.dataId),[a,i]=dR(s.values,o.shape,o.dtype);return e.makeTensorInfo(i,o.dtype,a)}let n;return O().getBool("WEBGL_PACK_UNARY_OPERATIONS")?n=new wr(o.shape,WZ):n=new We(o.shape,GZ),e.runWebGLProgram(n,[o],o.dtype)}var GZ,WZ,XO,jO=h(()=>{I();Nt();Je();Qa();GZ=Se+`
  return -x;
`,WZ=`
  vec4 result = -x;
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`;XO={kernelName:"Neg",backendName:"webgl",kernelFunc:UZ}});function KZ(r){k.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c}=o,l=e.readSync(n.dataId),u=e.readSync(s.dataId),{selectedIndices:p}=HZ(l,u,a,i,c);return e.makeTensorInfo([p.length],"int32",new Int32Array(p))}var HZ,YO,ZO=h(()=>{I();HZ=Ye.nonMaxSuppressionV3Impl;YO={kernelName:oc,backendName:"webgl",kernelFunc:KZ}});function XZ(r){k.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c,padToMaxOutputSize:l}=o,u=e.readSync(n.dataId),p=e.readSync(s.dataId),{selectedIndices:m,validOutputs:f}=qZ(u,p,a,i,c,l);return[e.makeTensorInfo([m.length],"int32",new Int32Array(m)),e.makeTensorInfo([],"int32",new Int32Array([f]))]}var qZ,QO,JO=h(()=>{I();qZ=Ye.nonMaxSuppressionV4Impl;QO={kernelName:nc,backendName:"webgl",kernelFunc:XZ}});function YZ(r){k.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c,softNmsSigma:l}=o,u=e.readSync(n.dataId),p=e.readSync(s.dataId),m=a,f=i,d=c,x=l,{selectedIndices:g,selectedScores:y}=jZ(u,p,m,f,d,x);return[e.makeTensorInfo([g.length],"int32",new Int32Array(g)),e.makeTensorInfo([y.length],"float32",new Float32Array(y))]}var jZ,tP,eP=h(()=>{I();jZ=Ye.nonMaxSuppressionV5Impl;tP={kernelName:sc,backendName:"webgl",kernelFunc:YZ}});var Hh,rP=h(()=>{Hh=class{constructor(t,e,o,n){this.variableNames=["indices"],this.outputShape=[t,e],this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int index = round(getIndices(coords.x));
        setOutput(mix(float(${n}), float(${o}),
                      float(index == coords.y)));
      }
    `}}});var ZZ,oP,nP=h(()=>{I();rP();Xt();ZZ=r=>{let{inputs:t,backend:e,attrs:o}=r,{indices:n}=t,{dtype:s,depth:a,onValue:i,offValue:c}=o,l=b.sizeFromShape(n.shape),u=new Hh(l,a,i,c),p=J({inputs:{x:n},backend:e,attrs:{shape:[l]}}),m=e.runWebGLProgram(u,[p],s);e.disposeIntermediateTensorInfo(p);let f=[...n.shape,a],d=J({inputs:{x:m},backend:e,attrs:{shape:f}});return e.disposeIntermediateTensorInfo(m),d},oP={kernelName:ic,backendName:"webgl",kernelFunc:ZZ}});function vp(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="complex64"){let n=wn({inputs:{input:o},backend:e}),s=vp({inputs:{x:n},backend:e}),a=ri({inputs:{input:o},backend:e}),i=vp({inputs:{x:a},backend:e}),c=Sr({inputs:{real:s,imag:i},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(i),c}else return Cn({attrs:{shape:o.shape,dtype:o.dtype,value:o.dtype==="string"?"":0},backend:e})}var sP,vv=h(()=>{I();bn();Gl();gp();Pl();sP={kernelName:Wc,backendName:"webgl",kernelFunc:vp}});function aP(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="string")throw new Error("onesLike is not supported under string dtype");if(o.dtype==="complex64"){let n=wn({inputs:{input:o},backend:e}),s=aP({inputs:{x:n},backend:e}),a=ri({inputs:{input:o},backend:e}),i=vp({inputs:{x:a},backend:e}),c=Sr({inputs:{real:s,imag:i},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(i),c}else return Cn({attrs:{shape:o.shape,dtype:o.dtype,value:1},backend:e})}var iP,cP=h(()=>{I();bn();Gl();gp();Pl();vv();iP={kernelName:ac,backendName:"webgl",kernelFunc:aP}});function QZ(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o;if(t.length===1)return $h({inputs:{input:t[0]},backend:e,attrs:{dim:n}});let s=t[0].shape,a=t[0].dtype;t.forEach(u=>{b.assertShapesMatch(s,u.shape,"All tensors passed to stack must have matching shapes"),b.assert(a===u.dtype,()=>"All tensors passed to stack must have matching dtypes")});let i=[],c=t.map(u=>{let p=$h({inputs:{input:u},backend:e,attrs:{dim:n}});return i.push(p),p}),l=Y0({inputs:c,backend:e,attrs:{axis:n}});return i.forEach(u=>e.disposeIntermediateTensorInfo(u)),l}var lP,uP=h(()=>{I();Z0();av();lP={kernelName:cc,backendName:"webgl",kernelFunc:QZ}});var Kh,pP=h(()=>{de();Kh=class{constructor(t,e,o){this.variableNames=["x"],this.customUniforms=[{name:"value",type:"float"}],this.outputShape=e.map((l,u)=>l[0]+t[u]+l[1]);let n=t.length,s=St(n),a=e.map(l=>l[0]).join(","),i=e.map((l,u)=>l[0]+t[u]).join(","),c=["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,n);if(n===1){this.userCode=`
        int start = ${a};
        int end = ${i};

        void main() {
          int outC = getOutputCoords();
          if (outC < start || outC >= end) {
            setOutput(value);
          } else {
            setOutput(getX(outC - start));
          }
        }
      `;return}this.userCode=`
      ${s} start = ${s}(${a});
      ${s} end = ${s}(${i});

      void main() {
        ${s} outC = getOutputCoords();
        if (any(lessThan(outC, start)) || any(greaterThanEqual(outC, end))) {
          setOutput(value);
        } else {
          ${s} coords = outC - start;
          setOutput(getX(${c}));
        }
      }
    `}}});var qh,mP=h(()=>{No();de();qh=class{constructor(t,e,o){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"value",type:"float"}],this.outputShape=e.map((x,g)=>x[0]+t[g]+x[1]);let n=t.length,s=St(n),a=e.map(x=>x[0]).join(","),i=e.map((x,g)=>x[0]+t[g]).join(","),c=he("rc",n),l=he("source",n),u=`${c[n-1]} < ${this.outputShape[n-1]}`,p=n===1?"source":`vec2(${l.slice(-2).join()})`,m=[`${s} rc = outputLoc;`,`${c[n-1]} += 1;
       if(${u}) {
      `,n===1?"":`}
       rc = outputLoc;
       ${c[n-2]} += 1;
       if(${c[n-2]} < ${this.outputShape[n-2]}) {`,n===1?"":`  ${c[n-1]} += 1;
         if(${u}) {`],f=n===1?"rc < start || rc >= end":"any(lessThan(rc, start)) || any(greaterThanEqual(rc, end))",d="";for(let x=0,g=n===1?2:4;x<g;x++)d+=`
        ${m[x]}
        if (${f}) {
          result[${x}] = float(value);
        } else {
          ${s} source = rc - start;
          result[${x}] = getChannel(getX(${l.join()}), ${p});
        }
      `;d+=n===1?"} ":"}}",this.userCode=`
      const ${s} start = ${s}(${a});
      const ${s} end = ${s}(${i});

      void main() {
        ${s} outputLoc = getOutputCoords();
        vec4 result = vec4(0.);
        ${d}
        setOutput(result);
      }
    `}}});var wv,fP,Cv=h(()=>{I();pP();mP();Gl();wv=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{paddings:s,constantValue:a}=o;if(b.sizeFromShape(n.shape)===0){let l=s.map((u,p)=>u[0]+n.shape[p]+u[1]);return Cn({backend:e,attrs:{shape:l,value:a,dtype:n.dtype}})}let i=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new qh(n.shape,s,a):new Kh(n.shape,s,a),c=[[a]];return e.runWebGLProgram(i,[n],n.dtype,c)},fP={kernelName:lc,backendName:"webgl",kernelFunc:wv}});var JZ,tQ,eQ,dP,hP=h(()=>{I();Mr();wt();JZ=`
  if(a < 0.0 && floor(b) < b){
    return NAN;
  }
  if (b == 0.0) {
    return 1.0;
  }
  return (round(mod(b, 2.0)) != 1) ?
      pow(abs(a), b) : sign(a) * pow(abs(a), b);
`,tQ=`
  // isModRound1 has 1 for components with round(mod(b, 2.0)) == 1, 0 otherwise.
  vec4 isModRound1 = vec4(equal(round(mod(b, 2.0)), ivec4(1)));
  vec4 multiplier = sign(a) * isModRound1 + (vec4(1.0) - isModRound1);
  vec4 result = multiplier * pow(abs(a), b);

  // Ensure that a^0 = 1, including 0^0 = 1 as this correspond to TF and JS
  bvec4 isExpZero = equal(b, vec4(0.0));
  result.r = isExpZero.r ? 1.0 : result.r;
  result.g = isExpZero.g ? 1.0 : result.g;
  result.b = isExpZero.b ? 1.0 : result.b;
  result.a = isExpZero.a ? 1.0 : result.a;

  bvec4 isNaN1 = lessThan(a, vec4(0.0));
  bvec4 isNaN2 = lessThan(floor(b), b);
  bvec4 isNaN = bvec4(isNaN1.x && isNaN2.x, isNaN1.y && isNaN2.y, isNaN1.z && isNaN2.z, isNaN1.w && isNaN2.w);
  `+Lr+`
  return result;
`,eQ=Wt({opSnippet:JZ,packedOpSnippet:tQ}),dP={kernelName:"Pow",backendName:"webgl",kernelFunc:eQ}});function rQ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o,i=n.shape.length,c=[],l=b.parseAxisParam(s,n.shape),u=l,p=k.getAxesPermutation(u,i),m=n;p!=null&&(m=re({inputs:{x:n},backend:e,attrs:{perm:p}}),u=k.getInnerMostAxes(u.length,i),c.push(m)),k.assertAxesAreInnerMostDims("prod",u,i);let f;if(e.shouldExecuteOnCPU([m])){let d=e.texData.get(m.dataId).values,{outVals:x,outShape:g,outDtype:y}=gR(m.shape,m.dtype,d,u);f=e.makeTensorInfo(g,y,x)}else{let[d,x]=k.computeOutAndReduceShapes(m.shape,u),g=b.sizeFromShape(x),y=J({inputs:{x:m},backend:e,attrs:{shape:[-1,g]}}),v=ha(n.dtype),N=Br(y,v,"prod",e);f=J({inputs:{x:N},backend:e,attrs:{shape:d}}),c.push(y),c.push(N)}if(a){c.push(f);let d=k.expandShapeToKeepDim(f.shape,l);f=J({inputs:{x:f},backend:e,attrs:{shape:d}})}return c.forEach(d=>e.disposeIntermediateTensorInfo(d)),f}var gP,xP=h(()=>{I();es();Nt();Xt();Vr();gP={kernelName:pc,backendName:"webgl",kernelFunc:rQ}});function oQ(r){let{inputs:t,backend:e,attrs:o}=r,{paramsNestedSplits:n,paramsDenseValues:s,indices:a}=t,{outputRaggedRank:i}=o,c=n.map(y=>e.readSync(y.dataId)),l=n.map(y=>y.shape),u=e.readSync(s.dataId),p=e.readSync(a.dataId),[m,f,d]=xR(c,l,u,s.shape,s.dtype,p,a.shape,i),x=m.map(y=>e.makeTensorInfo([y.length],"int32",y)),g=e.makeTensorInfo(d,s.dtype,f);return x.concat([g])}var yP,bP=h(()=>{I();Nt();yP={kernelName:mc,backendName:"webgl",kernelFunc:oQ}});function nQ(r){let{inputs:t,backend:e}=r,{starts:o,limits:n,deltas:s}=t,a=e.readSync(o.dataId),i=e.readSync(n.dataId),c=e.readSync(s.dataId),[l,u]=yR(a,o.shape,o.dtype,i,n.shape,c,s.shape),p=e.makeTensorInfo([l.length],"int32",l),m=e.makeTensorInfo([u.length],o.dtype,u);return[p,m]}var vP,wP=h(()=>{I();Nt();vP={kernelName:fc,backendName:"webgl",kernelFunc:nQ}});function sQ(r){let{inputs:t,backend:e,attrs:o}=r,{shape:n,values:s,defaultValue:a,rowPartitionTensors:i}=t,{rowPartitionTypes:c}=o,l=e.readSync(n.dataId),u=e.readSync(s.dataId),p=e.readSync(a.dataId),m=i.map(g=>e.readSync(g.dataId)),f=i.map(g=>g.shape),[d,x]=bR(l,n.shape,u,s.shape,s.dtype,p,a.shape,m,f,c);return e.makeTensorInfo(d,s.dtype,x)}var CP,SP=h(()=>{I();Nt();CP={kernelName:dc,backendName:"webgl",kernelFunc:sQ}});var Sv,NP,Nv=h(()=>{I();Nt();Sv=r=>{let{backend:t,attrs:e}=r,{start:o,stop:n,step:s,dtype:a}=e,i=vR(o,n,s,a);return t.makeTensorInfo([i.length],a,i)},NP={kernelName:hc,backendName:"webgl",kernelFunc:Sv}});var aQ,iQ,TP,IP=h(()=>{I();wt();aQ="return 1.0 / x;",iQ=pt({opSnippet:aQ}),TP={kernelName:Ks,backendName:"webgl",kernelFunc:iQ}});var cQ,lQ,uQ,kP,EP=h(()=>{I();wt();Je();cQ=Se+`
  return (x < 0.0) ? 0.0 : x;
`,lQ=`
  vec4 result = x * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,uQ=pt({opSnippet:cQ,packedOpSnippet:lQ}),kP={kernelName:qs,backendName:"webgl",kernelFunc:uQ}});var pQ,mQ,fQ,$P,RP=h(()=>{I();wt();Je();pQ=Se+`
  return (x < 0.0) ? 0.0 : min(6.0, x);
`,mQ=`
  vec4 result = min(x, vec4(6.)) * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,fQ=pt({opSnippet:pQ,packedOpSnippet:mQ}),$P={kernelName:Xs,backendName:"webgl",kernelFunc:fQ}});var Xh,AP=h(()=>{Xh=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.outputShape=[];let[a,i,c,l]=t;this.outputShape=[a,e,o,l];let u=[n&&e>1?i-1:i,n&&o>1?c-1:c],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m;s?m="(vec2(yRC) + vec2(0.5)) * effectiveInputOverOutputRatioRC - vec2(0.5)":m="vec2(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec2 effectiveInputOverOutputRatioRC = vec2(
          ${u[0]/p[0]},
          ${u[1]/p[1]});
      const vec2 inputShapeRC = vec2(${i}.0, ${c}.0);

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        ivec2 yRC = coords.yz;

        // Fractional source index.
        vec2 sourceFracIndexRC = ${m};

        // Compute the four integer indices.
        ivec2 sourceFloorRC = ivec2(max(sourceFracIndexRC, vec2(0.0)));
        ivec2 sourceCeilRC = ivec2(
          min(inputShapeRC - 1.0, ceil(sourceFracIndexRC)));

        float topLeft = getA(b, sourceFloorRC.x, sourceFloorRC.y, d);
        float bottomLeft = getA(b, sourceCeilRC.x, sourceFloorRC.y, d);
        float topRight = getA(b, sourceFloorRC.x, sourceCeilRC.y, d);
        float bottomRight = getA(b, sourceCeilRC.x, sourceCeilRC.y, d);

        vec2 fracRC = sourceFracIndexRC - vec2(sourceFloorRC);

        float top = topLeft + (topRight - topLeft) * fracRC.y;
        float bottom = bottomLeft + (bottomRight - bottomLeft) * fracRC.y;
        float newValue = top + (bottom - top) * fracRC.x;

        setOutput(newValue);
      }
    `}}});var jh,_P=h(()=>{jh=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[];let[a,i,c,l]=t;this.outputShape=[a,e,o,l];let u=[n&&e>1?i-1:i,n&&o>1?c-1:c],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m;s?m="(vec3(yRC) + vec3(0.5)) * effectiveInputOverOutputRatioRC - vec3(0.5)":m="vec3(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec3 effectiveInputOverOutputRatioRC = vec3(
          ${u[0]/p[0]},
          ${u[1]/p[1]},
          ${u[1]/p[1]});
      const vec3 inputShapeRC = vec3(${i}.0, ${c}.0,
                                     ${c}.0);

      float getAValue(int b, int r, int c, int d) {
        return getChannel(getA(b, r, c, d), vec2(c, d));
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        // Calculate values for next column in yRC.z.
        ivec3 yRC = coords.yzz + ivec3(0, 0, 1);

        // Fractional source index.
        vec3 sourceFracIndexRC = ${m};

        // Compute the four integer indices.
        ivec3 sourceFloorRC = ivec3(max(sourceFracIndexRC, vec3(0.0)));
        ivec3 sourceCeilRC = ivec3(
          min(inputShapeRC - 1.0, ceil(sourceFracIndexRC)));

        // Should we calculate next column and row elements in 2x2 packed cell.
        bool hasNextCol = d < ${l-1};
        bool hasNextRow = coords.z < ${o-1};

        // In parallel, construct four corners for all four components in
        // packed 2x2 cell.
        vec4 topLeft = vec4(
          getAValue(b, sourceFloorRC.x, sourceFloorRC.y, d),
          hasNextCol ? getAValue(b, sourceFloorRC.x, sourceFloorRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceFloorRC.x, sourceFloorRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceFloorRC.x, sourceFloorRC.z, d + 1) : 0.0);

        vec4 bottomLeft = vec4(
          getAValue(b, sourceCeilRC.x, sourceFloorRC.y, d),
          hasNextCol ? getAValue(b, sourceCeilRC.x, sourceFloorRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceCeilRC.x, sourceFloorRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceCeilRC.x, sourceFloorRC.z, d + 1) : 0.0);

        vec4 topRight = vec4(
          getAValue(b, sourceFloorRC.x, sourceCeilRC.y, d),
          hasNextCol ? getAValue(b, sourceFloorRC.x, sourceCeilRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceFloorRC.x, sourceCeilRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceFloorRC.x, sourceCeilRC.z, d + 1) : 0.0);

        vec4 bottomRight = vec4(
          getAValue(b, sourceCeilRC.x, sourceCeilRC.y, d),
          hasNextCol ? getAValue(b, sourceCeilRC.x, sourceCeilRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceCeilRC.x, sourceCeilRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceCeilRC.x, sourceCeilRC.z, d + 1) : 0.0);

        vec3 fracRC = sourceFracIndexRC - vec3(sourceFloorRC);

        vec4 top = mix(topLeft, topRight, fracRC.yyzz);
        vec4 bottom = mix(bottomLeft, bottomRight, fracRC.yyzz);
        vec4 newValue = mix(top, bottom, fracRC.x);

        setOutput(newValue);
      }
    `}}});function dQ(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:a,size:i}=o,[c,l]=i,u=O().getBool("WEBGL_PACK_IMAGE_OPERATIONS")?new jh(n.shape,c,l,s,a):new Xh(n.shape,c,l,s,a);return e.runWebGLProgram(u,[n],"float32")}var DP,FP=h(()=>{I();AP();_P();DP={kernelName:bc,backendName:"webgl",kernelFunc:dQ}});var Yh,OP=h(()=>{Yh=class{constructor(t,e,o){this.variableNames=["dy"],this.outputShape=[],this.outputShape=e;let[,n,s]=e,[,a,i]=t,c=[o&&a>1?n-1:n,o&&i>1?s-1:s],l=[o&&a>1?a-1:a,o&&i>1?i-1:i],u=c[0]/l[0],p=c[1]/l[1],m=1/u,f=1/p,d=Math.ceil(m)*2+2,x=Math.ceil(f)*2+2;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        int r = coords[1];
        int c = coords[2];

        float accumulator = 0.0;

        const float heightScale = float(${u});
        const float widthScale = float(${p});

        const float invHeightScale = float(${m});
        const float invWidthScale = float(${f});

        const int winHeight = int(${d});
        const int winWidth = int(${x});

        // Compute bounds for where in dy we will look
        float startRLerp = floor(float(r) * invHeightScale);
        int startDyR = int(startRLerp - float(winHeight / 2));

        float startCLerp = floor(float(c) * invWidthScale);
        int startDyC = int(startCLerp - float(winWidth / 2));

        // Loop over dy
        for (int dyROffset = 0; dyROffset < winHeight; dyROffset++) {
          int dyR = dyROffset + startDyR;

          // Guard against the window exceeding the bounds of dy
          if (dyR < 0 || dyR >= ${a}) {
            continue;
          }

          for (int dyCOffset = 0; dyCOffset < winWidth; dyCOffset++) {
            int dyC = dyCOffset + startDyC;

            // Guard against the window exceeding the bounds of dy
            if (dyC < 0 || dyC >= ${i}) {
              continue;
            }

            float dxR = float(dyR) * heightScale;
            int topDxRIndex = int(floor(dxR));
            int bottomDxRIndex = int(min(ceil(dxR), ${n-1}.0));
            float dxRLerp = dxR - float(topDxRIndex);
            float inverseDxRLerp = 1.0 - dxRLerp;

            float dxC = float(dyC) * widthScale;
            int leftDxCIndex = int(floor(dxC));
            int rightDxCIndex = int(min(ceil(dxC), ${s-1}.0));
            float dxCLerp = dxC - float(leftDxCIndex);
            float inverseDxCLerp = 1.0 - dxCLerp;

            if (r == topDxRIndex && c == leftDxCIndex) {
              // topLeft
              accumulator +=
                getDy(b, dyR, dyC, d) * inverseDxRLerp * inverseDxCLerp;
            }

            if (r == topDxRIndex && c == rightDxCIndex) {
              // topRight
              accumulator += getDy(b, dyR, dyC, d) * inverseDxRLerp * dxCLerp;
            }

            if (r == bottomDxRIndex && c == leftDxCIndex) {
              // bottomLeft
              accumulator += getDy(b, dyR, dyC, d) * dxRLerp * inverseDxCLerp;
            }

            if (r == bottomDxRIndex && c == rightDxCIndex) {
              // bottomRight
              accumulator += getDy(b, dyR, dyC, d) * dxRLerp * dxCLerp;
            }
          }
        }
        // End loop over dy

        setOutput(accumulator);
      }
    `}}});function hQ(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:a}=o,i=new Yh(s.shape,n.shape,a);return e.runWebGLProgram(i,[s],s.dtype)}var PP,LP=h(()=>{I();OP();PP={kernelName:Zp,backendName:"webgl",kernelFunc:hQ}});var Zh,MP=h(()=>{Zh=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.outputShape=[];let[a,i,c,l]=t;this.outputShape=[a,e,o,l];let u=[n&&e>1?i-1:i,n&&o>1?c-1:c],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m=n?"0.5":"0.0",f;s?f="max((vec2(yRC) + vec2(0.5)) * effectiveInputOverOutputRatioRC, vec2(0.0))":f="vec2(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec2 effectiveInputOverOutputRatioRC = vec2(
          ${u[0]/p[0]},
          ${u[1]/p[1]});
      const vec2 inputShapeRC = vec2(${i}.0, ${c}.0);

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        ivec2 yRC = coords.yz;

        // Fractional source index.
        vec2 sourceFracIndexRC = ${f};

        // Compute the coordinators of nearest neighbor point.
        ivec2 sourceNearestRC = ivec2(
          min(inputShapeRC - 1.0, floor(sourceFracIndexRC + ${m})));
        float newValue = getA(b, sourceNearestRC.x, sourceNearestRC.y, d);

        setOutput(newValue);
      }
    `}}});var Qh,BP=h(()=>{Qh=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[];let[a,i,c,l]=t;this.outputShape=[a,e,o,l];let u=[n&&e>1?i-1:i,n&&o>1?c-1:c],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m=n?"0.5":"0.0",f;s?f="max((vec3(yRC) + vec3(0.5)) * effectiveInputOverOutputRatioRC, vec3(0.0))":f="vec3(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec3 effectiveInputOverOutputRatioRC = vec3(
          ${u[0]/p[0]},
          ${u[1]/p[1]},
          ${u[1]/p[1]});
      const vec3 inputShapeRC = vec3(${i}.0, ${c}.0,
                                     ${c}.0);

      float getAValue(int b, int r, int c, int d) {
        return getChannel(getA(b, r, c, d), vec2(c, d));
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        // Calculate values for next column in yRC.z.
        ivec3 yRC = coords.yzz + ivec3(0, 0, 1);

        // Fractional source index.
        vec3 sourceFracIndexRC = ${f};

        // Compute the coordinators of nearest neighbor point.
        ivec3 sourceNearestRC = ivec3(
          min(inputShapeRC - 1.0, floor(sourceFracIndexRC + ${m})));

        // Should we calculate next column and row elements in 2x2 packed cell.
        bool hasNextCol = d < ${l-1};
        bool hasNextRow = coords.z < ${o-1};

        vec4 newValue = vec4(
          getAValue(b, sourceNearestRC.x, sourceNearestRC.y, d),
          hasNextCol ? getAValue(b, sourceNearestRC.x, sourceNearestRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceNearestRC.x, sourceNearestRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceNearestRC.x, sourceNearestRC.z, d + 1) : 0.0);

        setOutput(newValue);
      }
    `}}});function gQ(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:a,size:i}=o,[c,l]=i,u=O().getBool("WEBGL_PACK_IMAGE_OPERATIONS")?new Qh(n.shape,c,l,s,a):new Zh(n.shape,c,l,s,a);return e.runWebGLProgram(u,[n],n.dtype)}var VP,zP=h(()=>{I();MP();BP();VP={kernelName:yc,backendName:"webgl",kernelFunc:gQ}});var Jh,GP=h(()=>{Jh=class{constructor(t,e,o){this.variableNames=["dy"],this.outputShape=[],this.outputShape=e;let[,n,s]=e,[,a,i]=t,c=[o&&a>1?n-1:n,o&&i>1?s-1:s],l=[o&&a>1?a-1:a,o&&i>1?i-1:i],u=c[0]/l[0],p=c[1]/l[1],m=1/u,f=1/p,d=Math.ceil(m)*2+2,x=Math.ceil(f)*2+2;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        int r = coords[1];
        int c = coords[2];

        float accumulator = 0.0;

        const float heightScale = float(${u});
        const float widthScale = float(${p});

        const float invHeightScale = float(${m});
        const float invWidthScale = float(${f});

        const int winHeight = int(${d});
        const int winWidth = int(${x});

        // Compute bounds for where in dy we will look
        float startRLerp = floor(float(r) * invHeightScale);
        int startDyR = int(floor(startRLerp - float(winHeight / 2)));

        float startCLerp = floor(float(c) * invWidthScale);
        int startDyC = int(floor(startCLerp - float(winWidth / 2)));

        // Loop over dy
        for (int dyROffset = 0; dyROffset < winHeight; dyROffset++) {
          int dyR = dyROffset + startDyR;

          // Guard against the window exceeding the bounds of dy
          if (dyR < 0 || dyR >= ${a}) {
            continue;
          }

          for (int dyCOffset = 0; dyCOffset < winWidth; dyCOffset++) {
            int dyC = dyCOffset + startDyC;

            // Guard against the window exceeding the bounds of dy
            if (dyC < 0 || dyC >= ${i}) {
              continue;
            }

            float sourceFracRow =
              float(${c[0]}) *
                (float(dyR) / float(${l[0]}));

            float sourceFracCol =
                float(${c[1]}) *
                  (float(dyC) / float(${l[1]}));

            int sourceNearestRow = int(min(
                float(int(${n}) - 1),
                ${o} ? float(round(sourceFracRow)) :
                                  float(floor(sourceFracRow))));

            int sourceNearestCol = int(min(
                float(int(${s}) - 1),
                ${o} ? float(round(sourceFracCol)) :
                                  float(floor(sourceFracCol))));

            if (r == sourceNearestRow && c == sourceNearestCol) {
              accumulator += getDy(b, dyR, dyC, d);
            }
          }
        }
        // End loop over dy

        setOutput(accumulator);
      }
    `}}});function xQ(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:a}=o,i=new Jh(s.shape,n.shape,a);return e.runWebGLProgram(i,[s],s.dtype)}var WP,UP=h(()=>{I();GP();WP={kernelName:Yp,backendName:"webgl",kernelFunc:xQ}});var tg,HP=h(()=>{de();tg=class{constructor(t,e){this.variableNames=["x"];let o=t.length;if(o>4)throw new Error(`WebGL backend: Reverse of rank-${o} tensor is not yet supported`);if(this.outputShape=t,o===1){this.userCode=`
        void main() {
          int coord = getOutputCoords();
          setOutput(getX(${t[0]} - coord - 1));
        }
      `;return}let n=i=>e.indexOf(i)!==-1&&t[i]!==1?`${t[i]} - coords[${i}] - 1`:`coords[${i}]`,s=t.map((i,c)=>n(c)).join(","),a=St(o);this.userCode=`
      void main() {
        ${a} coords = getOutputCoords();
        setOutput(getX(${s}));
      }
    `}}});var eg,KP=h(()=>{No();de();eg=class{constructor(t,e){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0;let o=t.length;if(o>4)throw new Error(`WebGL backend: Reverse of rank-${o} tensor is not yet supported`);this.outputShape=t;let n=he("rc",o),s=`${n[o-1]} + 1 < ${this.outputShape[o-1]}`,a=`${n[o-2]} + 1 < ${this.outputShape[o-2]}`,i=St(o);o===1?this.userCode=`
        void main(){
          int rc = getOutputCoords();
          vec4 result = vec4(0.);
          result.r = getChannel(getX(${t[0]} - rc - 1),
            ${t[0]} - rc - 1);
          if(${s}){
              result.g = getChannel(getX(${t[0]} - (rc  + 1) - 1),
                ${t[0]} - (rc  + 1) - 1);
          }
          setOutput(result);
        }
      `:this.userCode=`
        void main() {
          ${i} rc = getOutputCoords();
          vec4 result = vec4(0.);
          result.r = ${c(n.slice())};
          if(${s}){
            result.g = ${l(n.slice())};
          }
          if(${a}) {
            result.b = ${u(n.slice())};
            if(${s}) {
              result.a = ${p(n.slice())};
            }
          }
          setOutput(result);
        }
    `;function c(d){return m(d)}function l(d){return d[o-1]="("+d[o-1]+" + 1)",m(d)}function u(d){return d[o-2]="("+d[o-2]+" + 1)",m(d)}function p(d){return d[o-1]="("+d[o-1]+" + 1)",d[o-2]="("+d[o-2]+" + 1)",m(d)}function m(d){let x=t.map((v,N)=>f(N,d)),g=x.join(","),y=x.slice(-2).join(",");return`getChannel(getX(${g}), vec2(${y}))`}function f(d,x){return e.indexOf(d)!==-1&&t[d]!==1?`${t[d]} - ${x[d]} - 1`:`${x[d]}`}}}});function yQ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dims:s}=o,a=n.shape.length,i=b.parseAxisParam(s,n.shape);if(a===0)return ge({inputs:{x:n},backend:e});let c=O().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new eg(n.shape,i):new tg(n.shape,i);return e.runWebGLProgram(c,[n],n.dtype)}var qP,XP=h(()=>{I();HP();KP();Qr();qP={kernelName:vc,backendName:"webgl",kernelFunc:yQ}});var rg,jP=h(()=>{rg=class{constructor(t,e){this.variableNames=["Image"],this.outputShape=[],this.customUniforms=[{name:"params",type:"vec4"}];let o=t[1],n=t[2];this.outputShape=t;let s="";typeof e=="number"?s=`float outputValue = ${e.toFixed(2)};`:s=`
        vec3 fill = vec3(${e.join(",")});
        float outputValue = fill[coords[3]];`,this.userCode=`
        void main() {
          ivec4 coords = getOutputCoords();
          int x = coords[2];
          int y = coords[1];
          float coordXFloat = (float(x) - params[0]) * params[3] -
            (float(y) - params[1]) * params[2];
          float coordYFloat = (float(x) - params[0]) * params[2] +
            (float(y) - params[1]) * params[3];
          int coordX = int(round(coordXFloat + params[0]));
          int coordY = int(round(coordYFloat + params[1]));
          ${s}
          if(coordX >= 0 && coordX < ${n} && coordY >= 0 && coordY < ${o}) {
            outputValue = getImage(coords[0], coordY, coordX, coords[3]);
          }
          setOutput(outputValue);
        }
    `}}});var YP,ZP=h(()=>{I();I();jP();YP={kernelName:Uc,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{image:o}=r,{radians:n,fillValue:s,center:a}=t,i=e,c=new rg(o.shape,s),[l,u]=k.getImageCenter(a,o.shape[1],o.shape[2]),p=[[l,u,Math.sin(n),Math.cos(n)]];return i.runWebGLProgram(c,[o],o.dtype,p)}}});var bQ,vQ,QP,JP=h(()=>{I();wt();bQ=`
  // OpenGL ES does not support round function.
  // The algorithm is based on banker's rounding.
  float base = floor(x);
  if ((x - base) < 0.5) {
    return floor(x);
  } else if ((x - base) > 0.5) {
    return ceil(x);
  } else {
    if (mod(base, 2.0) == 0.0) {
      return base;
    } else {
      return base + 1.0;
    }
  }
`,vQ=pt({opSnippet:bQ}),QP={kernelName:js,backendName:"webgl",kernelFunc:vQ}});var wQ,CQ,tL,eL=h(()=>{I();wt();Nt();wQ="return inversesqrt(x);",CQ=pt({opSnippet:wQ,cpuKernelImpl:wR}),tL={kernelName:Ys,backendName:"webgl",kernelFunc:CQ}});var ss,og=h(()=>{de();ss=class{constructor(t,e,o,n,s,a,i=!0,c=!1){this.variableNames=["updates","indices","defaultValue"],this.outputShape=a;let l=St(s.length),u=St(a.length),p="";o===1?p="i":o===2&&(p="i, j");let m=`getIndices(${p})`,f="";n===1?f="i":n===2&&(f="i, coords[1]");let d=`getUpdates(${f})`,x="";c&&(x="coords[0], coords[1]");let g=`getDefaultValue(${x})`,y=e>1?"strides[j]":"strides";this.userCode=`
        ${l} strides = ${l}(${s});

        void main() {
          ${u} coords = getOutputCoords();
          float sum = 0.0;
          bool found = false;
          for (int i = 0; i < ${t}; i++) {
            int flattenedIndex = 0;
            for (int j = 0; j < ${e}; j++) {
              int index = round(${m});
              flattenedIndex += index * ${y};
            }
            if (flattenedIndex == coords[0]) {
              sum += ${d};
              found = true;
            }
          }
          setOutput(mix(${g}, sum, float(found)));
        }
      `}}});var ng,rL=h(()=>{de();ng=class{constructor(t,e,o,n,s,a,i=!0,c=!1){this.variableNames=["updates","indices","defaultValue"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=a;let l=St(s.length),u=St(a.length),p="";o===1?p="i":o===2&&(p="i, j");let m=`getIndices(${p})`,f="";n===1?f="i":n===2&&(f="i, coords[1]");let d=`getUpdates(${f})`,x="";c&&(x="coords[0], coords[1]");let g=`getDefaultValue(${x})`,y=e>1?"strides[j]":"strides",v=e>1?"strides[j + 1]":"strides";this.userCode=`
        ${l} strides = ${l}(${s});

        void main() {
          ${u} coords = getOutputCoords();
          vec4 sum = vec4(0.);
          vec4 found = vec4(0.);
          for (int i = 0; i < ${t}; i+=2) {
            ivec2 flattenedIndex = ivec2(0);
            for (int j = 0; j < ${e}; j+=2) {
              ivec4 index = round(${m});
              flattenedIndex += index.xz * ${y};
              if (j + 1 < ${e}) {
                flattenedIndex += index.yw * ${v};
              }
            }
            if (flattenedIndex[0] == coords[0] || flattenedIndex[1] == coords[0] ||
                flattenedIndex[0] == coords[0] + 1 || flattenedIndex[1] == coords[0] + 1) {
              vec4 updVals = ${d};
              if (flattenedIndex[0] == coords[0]) {
                sum.xy += updVals.xy;
                found.xy = vec2(1.);
              } else if (flattenedIndex[0] == coords[0] + 1) {
                sum.zw += updVals.xy;
                found.zw = vec2(1.);
              }
              if (flattenedIndex[1] == coords[0]) {
                sum.xy += updVals.zw;
                found.xy = vec2(1.);
              } else if (flattenedIndex[1] == coords[0] + 1) {
                sum.zw += updVals.zw;
                found.zw = vec2(1.);
              }
            }
          }
          setOutput(mix(${g}, sum, found));
        }
      `}}});function SQ(r){let{inputs:t,backend:e,attrs:o}=r,{indices:n,updates:s}=t,{shape:a}=o,{sliceRank:i,numUpdates:c,sliceSize:l,strides:u,outputSize:p}=k.calculateShapes(s,n,a),m=[p/l,l];if(p===0)return e.makeTensorInfo(a,n.dtype);let f=J({inputs:{x:n},backend:e,attrs:{shape:[c,i]}}),d=J({inputs:{x:s},backend:e,attrs:{shape:[c,l]}}),x=e.makeTensorInfo([],"float32",new Float32Array([0])),g;O().getBool("WEBGL_PACK")?g=new ng(c,i,f.shape.length,d.shape.length,u,m):g=new ss(c,i,f.shape.length,d.shape.length,u,m);let y=e.runWebGLProgram(g,[d,f,x],d.dtype),v=J({inputs:{x:y},backend:e,attrs:{shape:a}});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(y),e.disposeIntermediateTensorInfo(x),v}var oL,nL=h(()=>{I();og();rL();Xt();oL={kernelName:wc,backendName:"webgl",kernelFunc:SQ}});var sg,sL=h(()=>{I();sg=class{constructor(t,e,o,n){this.variableNames=["sortedSequence","values"],this.customUniforms=[{name:"numInputs",type:"int"}],this.outputShape=[t,o];let s="while (left < right) {",a=`for (int i = 0; i < ${Math.ceil(Math.log2(e+1))}; ++i) { if (left >= right) break;`,i=O().getNumber("WEBGL_VERSION")===2?s:a,c=n==="left"?"<":"<=";this.userCode=`
       int findBound(int batch, float value) {
         int left = 0;
         int right = numInputs;
         int mid;
         ${i}
           mid = (left + right) / 2;
           if (getSortedSequence(batch, mid) ${c} value) {
             left = mid + 1;
           } else {
             right = mid;
           }
         }
         return right;
       }

       void main() {
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int valueIndex = coords[1];

         float value = getValues(batch, valueIndex);

         setOutput(float(findBound(batch, value)));
       }
     `}}});function NQ(r){let{inputs:t,backend:e,attrs:o}=r,{sortedSequence:n,values:s}=t,{side:a}=o,i=new sg(n.shape[0],n.shape[1],s.shape[1],a),c=[[n.shape[1]]];return e.runWebGLProgram(i,[n,s],"int32",c)}var aL,iL=h(()=>{I();sL();aL={kernelName:Sc,backendName:"webgl",kernelFunc:NQ}});var ag,cL=h(()=>{de();ag=class{constructor(t,e,o){this.variableNames=["c","a","b"],this.outputShape=e;let n,s;if(o>4)throw Error(`Where for rank ${o} is not yet supported`);if(o===1)s="resRC",n="resRC";else{let i=["resRC.x","resRC.y","resRC.z","resRC.w"],c=[],l=[];for(let u=0;u<e.length;u++)l.push(`${i[u]}`),u<t&&c.push(`${i[u]}`);n=c.join(),s=l.join()}let a=St(o);this.userCode=`
      void main() {
        ${a} resRC = getOutputCoords();
        float cVal = getC(${n});
        if (cVal >= 1.0) {
          setOutput(getA(${s}));
        } else {
          setOutput(getB(${s}));
        }
      }
    `}}});function TQ(r){let{inputs:t,backend:e}=r,{condition:o,t:n,e:s}=t,a=new ag(o.shape.length,n.shape,n.shape.length);return e.runWebGLProgram(a,[o,n,s],be(n.dtype,s.dtype))}var lL,uL=h(()=>{I();cL();lL={kernelName:Nc,backendName:"webgl",kernelFunc:TQ}});var IQ,kQ,pL,mL=h(()=>{I();wt();IQ=`
  // Stable and Attracting Fixed Point (0, 1) for Normalized Weights.
  // see: https://arxiv.org/abs/1706.02515
  float scaleAlpha = ${k.SELU_SCALEALPHA};
  float scale = ${k.SELU_SCALE};
  return (x >= 0.0) ? scale * x : scaleAlpha * (exp(x) - 1.0);
`,kQ=pt({opSnippet:IQ}),pL={kernelName:Zs,backendName:"webgl",kernelFunc:kQ}});var EQ,$Q,RQ,fL,dL=h(()=>{I();wt();Nt();EQ=mo+`
  return 1.0 / (1.0 + exp(-1.0 * x));
`,$Q=`
  vec4 result = 1.0 / (1.0 + exp(-1.0 * x));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,RQ=pt({opSnippet:EQ,packedOpSnippet:$Q,cpuKernelImpl:SR}),fL={kernelName:ta,backendName:"webgl",kernelFunc:RQ}});var AQ,_Q,hL,gL=h(()=>{I();wt();AQ=`
  if (isnan(x)) { return 0.0; }
  return sign(x);
`,_Q=pt({opSnippet:AQ}),hL={kernelName:Js,backendName:"webgl",kernelFunc:_Q}});var DQ,FQ,OQ,xL,yL=h(()=>{I();Mr();wt();DQ=mo+`
  return sin(x);
`,FQ=`
  vec4 result = sin(x);
  bvec4 isNaN = isnan(x);
  ${Lr}
  return result;
`,OQ=pt({opSnippet:DQ,packedOpSnippet:FQ}),xL={kernelName:"Sin",backendName:"webgl",kernelFunc:OQ}});var PQ,LQ,bL,vL=h(()=>{I();wt();PQ=`
  float e2x = exp(x);
  return (e2x - 1.0 / e2x) / 2.0;
`,LQ=pt({opSnippet:PQ}),bL={kernelName:Qs,backendName:"webgl",kernelFunc:LQ}});var MQ,BQ,wL,CL=h(()=>{I();wt();MQ=`
  float epsilon = 1.1920928955078125e-7;
  float threshold = log(epsilon) + 2.0;

  bool too_large = x > -threshold;
  bool too_small = x < threshold;

  float result;
  float exp_x = exp(x);

  if (too_large){
    result = x;
  }
  else if (too_small){
    result = exp_x;
  }
  else{
    result = log(exp_x + 1.0);
  }
  return result;
`,BQ=pt({opSnippet:MQ}),wL={kernelName:ea,backendName:"webgl",kernelFunc:BQ}});var VQ,SL,NL=h(()=>{I();Cv();Xt();Vr();VQ=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,paddings:a}=o;b.assert(n.shape.length<=4,()=>"spaceToBatchND for rank > 4 with a WebGL backend not implemented yet");let i=s.reduce((y,v)=>y*v),c=[[0,0]];c.push(...a);for(let y=1+s.length;y<n.shape.length;++y)c.push([0,0]);let l=[],u=wv({inputs:{x:n},backend:e,attrs:{paddings:c,constantValue:0}}),p=k.getReshaped(u.shape,s,i,!1),m=k.getPermuted(p.length,s.length,!1),f=k.getReshapedPermuted(u.shape,s,i,!1),d=J({inputs:{x:u},backend:e,attrs:{shape:p}}),x=re({inputs:{x:d},backend:e,attrs:{perm:m}}),g=J({inputs:{x},backend:e,attrs:{shape:f}});return l.push(u),l.push(d),l.push(x),l.forEach(y=>e.disposeIntermediateTensorInfo(y)),g},SL={kernelName:Ic,backendName:"webgl",kernelFunc:VQ}});function zQ(r){let{inputs:t,backend:e}=r,{indices:o,values:n,denseShape:s,defaultValue:a}=t;if(s.shape.length!==1)throw new Error(`Dense shape must be a vector, saw:
         ${s.shape}`);if(o.shape.length!==2)throw new Error(`Indices must be a matrix, saw:
         ${o.shape}`);if(n.shape.length!==1)throw new Error(`Values must be a vector, saw:
         ${n.shape}`);if(a.shape.length!==0)throw new Error(`Default value must be a scalar, saw:
        ${a.shape}`);let i=e.readSync(o.dataId),c=e.readSync(n.dataId),l=e.readSync(s.dataId),u=e.readSync(a.dataId)[0],[p,m,f,d,x]=TR(i,o.shape,o.dtype,c,n.dtype,l,u);return[e.makeTensorInfo(m,o.dtype,p),e.makeTensorInfo([m[0]],n.dtype,f),e.makeTensorInfo([d.length],"bool",new Uint8Array(d.map(g=>Number(g)))),e.makeTensorInfo([x.length],o.dtype,new Int32Array(x))]}var TL,IL=h(()=>{I();Nt();TL={kernelName:$c,backendName:"webgl",kernelFunc:zQ}});function GQ(r){let{inputs:t,backend:e}=r,{inputIndices:o,inputShape:n,newShape:s}=t;if(o.shape.length!==2)throw new Error(`Input indices should be a matrix but received shape ${o.shape}`);if(n.shape.length!==1)throw new Error(`Input shape should be a vector but received shape ${n.shape}`);if(s.shape.length!==1)throw new Error(`Target shape should be a vector but received shape ${s.shape}`);let a=Array.from(e.readSync(n.dataId)),i=e.readSync(o.dataId),c=Array.from(e.readSync(s.dataId)),[l,u,p]=IR(i,o.shape,o.dtype,a,c);return[e.makeTensorInfo(u,o.dtype,l),e.makeTensorInfo([p.length],s.dtype,new Int32Array(p))]}var kL,EL=h(()=>{I();Nt();kL={kernelName:Rc,backendName:"webgl",kernelFunc:GQ}});function WQ(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
              ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
              ${s.shape}`);let a=e.readSync(o.dataId),i=e.readSync(n.dataId),c=e.readSync(s.dataId),[l,u]=Pd(a,o.shape,o.dtype,i,c,!0);return e.makeTensorInfo(u,o.dtype,l)}var $L,RL=h(()=>{I();Nt();$L={kernelName:Ac,backendName:"webgl",kernelFunc:WQ}});function UQ(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
             ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
             ${s.shape}`);let a=e.readSync(o.dataId),i=e.readSync(n.dataId),c=e.readSync(s.dataId),[l,u]=Pd(a,o.shape,o.dtype,i,c);return e.makeTensorInfo(u,o.dtype,l)}var AL,_L=h(()=>{I();Nt();AL={kernelName:_c,backendName:"webgl",kernelFunc:UQ}});function HQ(r){let{inputs:t,backend:e,attrs:o}=r,{sparseIndices:n,sparseValues:s,defaultValue:a}=t,{outputShape:i}=o,{sliceRank:c,numUpdates:l,sliceSize:u,strides:p,outputSize:m}=k.calculateShapes(s,n,i),f=!1;if(s.dtype==="string"){let y=e.bufferSync(n),v=e.bufferSync(s),N=b.decodeString(e.readSync(a.dataId)[0]),S=CR(y,v,i,m,u,l,c,p,N,f);return e.makeTensorInfo(i,S.dtype,S.values)}let d=new ss(l,c,n.shape.length,s.shape.length,p,[m,1],f),x=e.runWebGLProgram(d,[s,n,a],s.dtype),g=J({inputs:{x},backend:e,attrs:{shape:i}});return e.disposeIntermediateTensorInfo(x),g}var DL,FL=h(()=>{I();Nt();og();Xt();DL={kernelName:Dc,backendName:"webgl",kernelFunc:HQ}});function KQ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{numOrSizeSplits:s,axis:a}=o,i=b.parseAxisParam(a,n.shape)[0],c=k.prepareSplitSize(n,s,i),l=n.shape.length,u=new Array(l).fill(0),p=n.shape.slice();return c.map(m=>{let f=[...p];f[i]=m;let d=Io({inputs:{x:n},backend:e,attrs:{begin:u,size:f}});return u[i]+=m,d})}var OL,PL=h(()=>{I();ei();OL={kernelName:kc,backendName:"webgl",kernelFunc:KQ}});var LL,qQ,ML,BL=h(()=>{I();wt();Nt();LL="return sqrt(x);",qQ=pt({opSnippet:LL,packedOpSnippet:LL,cpuKernelImpl:kR}),ML={kernelName:ra,backendName:"webgl",kernelFunc:qQ}});var XQ,jQ,VL,zL=h(()=>{I();wt();XQ="return x * x;",jQ=pt({opSnippet:XQ}),VL={kernelName:Qp,backendName:"webgl",kernelFunc:jQ}});var GL,YQ,WL,UL=h(()=>{I();wt();GL="return (a - b) * (a - b);",YQ=Wt({opSnippet:GL,packedOpSnippet:GL}),WL={kernelName:oa,backendName:"webgl",kernelFunc:YQ}});function ZQ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;if(n.dtype!=="string")throw new Error("Input must be of datatype string");let s=e.readSync(n.dataId),a=k.fromUint8ToStringArray(s),i=ER(a,"string",o);return e.makeTensorInfo(n.shape,"string",i)}var HL,KL=h(()=>{I();Nt();HL={kernelName:na,backendName:"webgl",kernelFunc:ZQ}});function QQ({inputs:r,attrs:t,backend:e}){let{x:o}=r,n=Se+`
    return x > 0.0 ? 1.0 : float(${t.alpha});
  `,s=new We(o.shape,n);return e.runWebGLProgram(s,[o],o.dtype)}var qL,XL=h(()=>{I();Je();qL={kernelName:aa,backendName:"webgl",kernelFunc:QQ}});var ig,jL=h(()=>{de();ig=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=o;let n=o.length,s=St(o.length),a=St(o.length),i="";if(n===1)i="coords * strides + begin";else{let c=0;i=o.map((l,u)=>(c++,o.length===1?`coords * strides[${u}] + begin[${u}]`:`coords[${c-1}] * strides[${u}] + begin[${u}]`)).join(",")}this.userCode=`
      ${s} begin = ${s}(${t});
      ${s} strides = ${s}(${e});

      void main() {
        ${a} coords = getOutputCoords();
        setOutput(getX(${i}));
      }
    `}}});function JQ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,end:a,strides:i,beginMask:c,endMask:l,ellipsisMask:u,newAxisMask:p,shrinkAxisMask:m}=o,{finalShapeSparse:f,finalShape:d,isIdentity:x,sliceDim0:g,isSimpleSlice:y,begin:v,end:N,strides:S}=Fe.sliceInfo(n.shape,s,a,i,c,l,u,p,m),R;if(x)R=J({inputs:{x:n},backend:e,attrs:{shape:d}});else if(g||y){b.assert(n.shape.length>=1,()=>`Input must have rank at least 1, got: ${n.shape.length}`);let _=Fe.computeOutShape(v,N,S),D=Io({inputs:{x:n},backend:e,attrs:{begin:v,size:_}});R=J({inputs:{x:D},backend:e,attrs:{shape:d}}),e.disposeIntermediateTensorInfo(D)}else if(e.shouldExecuteOnCPU([n])){let D=e.readSync(n.dataId),L=ut(n.shape,n.dtype,D),M=$R(f,L,S,v);R=e.makeTensorInfo(d,n.dtype,M.values)}else{let D=new ig(v,S,f);R=e.runWebGLProgram(D,[n],n.dtype)}let A=J({inputs:{x:R},backend:e,attrs:{shape:d}});return e.disposeIntermediateTensorInfo(R),A}var YL,ZL=h(()=>{I();Nt();jL();Xt();ei();YL={kernelName:Fc,backendName:"webgl",kernelFunc:JQ}});function t9(r){let{inputs:t,backend:e,attrs:o}=r,{separator:n,nGramWidths:s,leftPad:a,rightPad:i,padWidth:c,preserveShortSequences:l}=o,{data:u,dataSplits:p}=t,m=e.readSync(u.dataId),f=e.readSync(p.dataId),[d,x]=RR(m,f,n,s,a,i,c,l);return[e.makeTensorInfo([d.length],"string",d),e.makeTensorInfo(p.shape,"int32",x)]}var QL,JL=h(()=>{I();Nt();QL={kernelName:Oc,backendName:"webgl",kernelFunc:t9}});function e9(r){let{inputs:t,backend:e,attrs:o}=r,{skipEmpty:n}=o,{input:s,delimiter:a}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(s.shape.length!==1)throw new Error(`Input must be a vector, got shape: ${s.shape}`);if(a.shape.length!==0)throw new Error(`Delimiter must be a scalar, got shape: ${a.shape}`);let i=e.readSync(s.dataId),c=e.readSync(a.dataId)[0],[l,u,p]=AR(i,c,n),m=u.length;return[e.makeTensorInfo([m,2],"int32",l),e.makeTensorInfo([m],"string",u),e.makeTensorInfo([2],"int32",new Int32Array(p))]}var t3,e3=h(()=>{I();Nt();t3={kernelName:Pc,backendName:"webgl",kernelFunc:e9}});function r9(r){let{inputs:t,backend:e,attrs:o}=r,{numBuckets:n}=o,{input:s}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(n<=0)throw new Error("Number of buckets must be at least 1");let a=e.readSync(s.dataId),i=_R(a,n);return e.makeTensorInfo(s.shape,"int32",i)}var r3,o3=h(()=>{I();Nt();r3={kernelName:Lc,backendName:"webgl",kernelFunc:r9}});var o9,n9,n3,s3=h(()=>{I();wt();o9="return tan(x);",n9=pt({opSnippet:o9}),n3={kernelName:"Tan",backendName:"webgl",kernelFunc:n9}});var s9,a9,a3,i3=h(()=>{I();wt();s9=`
  float e2x = exp(-2.0 * abs(x));
  return sign(x) * (1.0 - e2x) / (1.0 + e2x);
`,a9=pt({opSnippet:s9}),a3={kernelName:sa,backendName:"webgl",kernelFunc:a9}});function i9(r){let{inputs:t,backend:e,attrs:o}=r,{tensor:n,indices:s,updates:a}=t,{}=o,{sliceRank:i,numUpdates:c,sliceSize:l,strides:u,outputSize:p}=k.calculateShapes(a,s,n.shape),m=[p/l,l];if(p===0)return e.makeTensorInfo(n.shape,s.dtype);let f=J({inputs:{x:s},backend:e,attrs:{shape:[c,i]}}),d=J({inputs:{x:a},backend:e,attrs:{shape:[c,l]}}),x=J({inputs:{x:n},backend:e,attrs:{shape:m}}),g=new ss(c,i,f.shape.length,d.shape.length,u,m,!1,!0),y=e.runWebGLProgram(g,[d,f,x],x.dtype),v=J({inputs:{x:y},backend:e,attrs:{shape:n.shape}});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(y),v}var c3,l3=h(()=>{I();og();Xt();c3={kernelName:Cc,backendName:"webgl",kernelFunc:i9}});function c9(r){let t=r.length;if(t>5)throw Error(`Tile for rank ${t} is not yet supported`);if(t===1)return`imod(resRC, ${r[0]})`;let e=["resRC.x","resRC.y","resRC.z","resRC.w","resRC.u"],o=[];for(let n=0;n<r.length;n++)o.push(`imod(${e[n]}, ${r[n]})`);return o.join()}var cg,u3=h(()=>{de();cg=class{constructor(t,e){this.variableNames=["A"];let o=new Array(t.length);for(let a=0;a<o.length;a++)o[a]=t[a]*e[a];this.outputShape=o,this.rank=o.length;let n=St(this.rank),s=c9(t);this.userCode=`
      void main() {
        ${n} resRC = getOutputCoords();
        setOutput(getA(${s}));
      }
    `}}});function Tv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reps:s}=o;if(n.dtype==="string"||n.shape.length>5){let c=e.readSync(n.dataId),l=n.dtype==="string"?c.map(m=>b.decodeString(m)):c,u=ut(n.shape,n.dtype,l),p=FR(u,s);return e.makeTensorInfo(p.shape,p.dtype,p.values)}let a=new cg(n.shape,s);return e.runWebGLProgram(a,[n],n.dtype)}var p3,Iv=h(()=>{I();Nt();u3();p3={kernelName:Rn,backendName:"webgl",kernelFunc:Tv}});var lg,ug,m3=h(()=>{lg=class{constructor(t){this.variableNames=["x","indices"],this.customUniforms=[{name:"n",type:"int"},{name:"firstPass",type:"int"},{name:"negativeInf",type:"float"},{name:"dir",type:"int"},{name:"inc",type:"int"}],this.outputShape=t,this.userCode=`
       void main() {
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int elemIdx = coords[1];

         // We compare elements pair-wise within a group of size 2 * inc.
         // The comparing rule for each group alternates between ascending
         // and descending. Within each group, we compare each pair at
         // positions i and i+inc. To decide whether an element at position i
         // is x0 or x1, we mod it by 2 * inc, if the result is smaller than
         // inc, it is in the first half of the group, we denote it as x0,
         // otherwise we denote it as x1.
         // For example, as shown in the Bitonic top K paper referenced above,
         // Figure5(a) shows that element[1] is in the
         // second half of the group when group size is 2, but it is in the
         // first half of the group when group size is 4.

         bool isFirstInPair = imod(elemIdx, 2 * inc) < inc;
         int i = isFirstInPair ? elemIdx : elemIdx - inc;

         int i0 = firstPass == 1 ? i : int(getIndices(batch, i));
         int i1 = firstPass == 1 ? i + inc : int(getIndices(batch, i + inc));
         float x0 = i0 < n ? getX(batch, i0) : negativeInf;
         float x1 = i1 < n ? getX(batch, i1) : negativeInf;

         // Denotes which direction indices are in (ascending or descending).
         bool reverse = imod(elemIdx, 2 * dir) >= dir;
         bool isGreater = x0 > x1 || (x0 == x1 && i1 > i0);
         if (reverse == isGreater) { // Elements in opposite order of direction
           int iTemp = i0;
           i0 = i1;
           i1 = iTemp;
         }
         if (isFirstInPair) {
            setOutput(float(i0));
         } else {
            setOutput(float(i1));
         }
       }
     `}},ug=class{constructor(t){this.variableNames=["x","indices"],this.customUniforms=[{name:"n",type:"int"},{name:"firstPass",type:"int"},{name:"k",type:"int"}],this.outputShape=t,this.userCode=`
    void main() {
         // Takes max of indices (0, k), (1, k + 1), (2, k + 2) ...
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int elemIdx = coords[1];

         // The output size is half of the previous size.
         // If the previous sequence is | | | | _ _ _ _  | | | |  _ _ _ _ (k=4),
         // we only need to output the indices at positions |, the indices at
         // positions _ can be thrown away, see Figure5(b) After Phase 2
         // (Merge phase) in the Bitonic Top K paper referenced above.
         // For example, the paper shows we only need to output the orange bars.
         // The output sequence should look like this | | | | | | | |.
         // Because the sequence is halved, to map the output index back
         // to the previous sequence to find the corresponding value,
         // we need to double the index. When we double the index,
         // we basically interpolate a position, so 2i looks like
         // | _ | _ | _ | _ | _ | _ | _. We move the | to the first k position
         // of each 2k positions by - elemIdx % k. E.g. for output at
         // index 4,5,6,7, we want to get the corresponding element at
         // original index 8,9,10,11, for output at index 8,9,10,11,
         // we want to get the corresponding element at original index
         // 16,17,18,19, so on and so forth.

         int i = elemIdx < k ? elemIdx : (elemIdx * 2 - imod(elemIdx, k));
         int i0 = firstPass == 1 ? i : int(getIndices(batch, i));
         int i1 = firstPass == 1 ? i + k : int(getIndices(batch, i + k));

         float x0 = getX(batch, i0);
         float x1 = i1 < n ? getX(batch, i1) : x0;

         setOutput(x0 >= x1 ? float(i0) : float(i1));
       }
     `}}});function ni(r,t){t!==null&&r.disposeIntermediateTensorInfo(t)}function f3(r){let t=1;for(;t<r;)t*=2;return t}function l9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{k:s,sorted:a}=o,i=O().getNumber("TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD"),c=O().getNumber("TOPK_K_CPU_HANDOFF_THRESHOLD"),l=n.shape,u=l[l.length-1];if(e.shouldExecuteOnCPU([n])||u<i||s>c){let M=e.readSync(n.dataId),[V,W]=OR(M,l,n.dtype,s,a);return[e.makeTensorInfo(V.shape,V.dtype,V.values),e.makeTensorInfo(W.shape,W.dtype,W.values)]}if(s===0)return l[l.length-1]=0,[e.makeTensorInfo(l,n.dtype,[]),e.makeTensorInfo(l,"int32",[])];if(u===1)return[n,Cn({attrs:{shape:l,dtype:"int32",value:0},backend:e})];let p=e.texData.get(n.dataId),m=p!==null&&p.isPacked,f=m?e.unpackTensor(n):n,x=b.sizeFromShape(l)/u,g=J({inputs:{x:f},attrs:{shape:[x,u]},backend:e});m&&ni(e,f);let y=f3(s),v=f3(u),N=null,S=()=>N===null?[g,g]:[g,N],R=(M,V,W)=>{let G=S(),K=new lg(W),j=[[u],[N===null?1:0],[Number.NEGATIVE_INFINITY],[M],[V]],Z=N;N=e.runWebGLProgram(K,G,"int32",j),ni(e,Z)};for(let M=1;M<y;M*=2){let V=M*2;for(let W=M;W>=1;W/=2)R(V,W,[x,v])}for(let M=v;M>y;M/=2){let V=S(),W=new ug([x,M/2]),K=[[u],[N===null?1:0],[y]],U=N;N=e.runWebGLProgram(W,V,"int32",K),ni(e,U);let j=y/2,Z=j*2;for(let q=j;q>=1;q/=2)R(Z,q,N.shape)}let A=N;N=Io({inputs:{x:N},backend:e,attrs:{begin:0,size:[x,s]}}),ni(e,A);let _=lv({inputs:{x:g,indices:N},backend:e,attrs:{axis:1,batchDims:1}});ni(e,g);let D=l.slice(0,-1);D.push(s),A=N,N=J({inputs:{x:N},attrs:{shape:D},backend:e}),ni(e,A);let L=_;return _=J({inputs:{x:_},attrs:{shape:D},backend:e}),ni(e,L),[_,N]}var d3,h3=h(()=>{I();Nt();m3();Gl();uv();Xt();ei();d3={kernelName:Mc,backendName:"webgl",kernelFunc:l9}});var pg,g3=h(()=>{pg=class{constructor(t,e,o,n,s,a){this.variableNames=["Image","Transforms"],this.outputShape=a;let i=o==="nearest"?1:2,c;switch(n){case"constant":c=1;break;case"reflect":c=2;break;case"wrap":c=3;break;case"nearest":c=4;break;default:c=1;break}this.userCode=`
            float mapCoord(float outCoord, float len) {
              float inCoord = outCoord;
              if(${c} == 2) {
                if (inCoord < 0.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz2 = 2.0 * len;
                    if (inCoord < sz2) {
                      inCoord = sz2 * float(int(float(-inCoord / sz2))) +
                      inCoord;
                    }
                    inCoord = inCoord < -len ? inCoord + sz2 : -inCoord - 1.0;
                  }
                } else if (inCoord > len - 1.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz2 = 2.0 * len;
                    inCoord -= sz2 * float(int(float(inCoord / sz2)));
                    if (inCoord >= len) {
                      inCoord = sz2 - inCoord - 1.0;
                    }
                  }
                }
                return clamp(inCoord, 0.0, len - 1.0);
              } else if (${c} == 3) {
                if (inCoord < 0.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz = len - 1.0;
                    inCoord += len * (float(int(float(-inCoord / sz))) + 1.0);
                  }
                } else if (inCoord > len - 1.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz = len - 1.0;
                    inCoord -= len * float(int(float(inCoord / sz)));
                  }
                }
                return clamp(inCoord, 0.0, len - 1.0);
              } else if (${c} == 4) {
                return clamp(outCoord, 0.0, len - 1.0);
              } else {
                return outCoord;
              }
            }

            float readWithFillValue(int batch, int coordY, int coordX,
              int channel) {
              float outputValue;
              if (0 <= coordY && coordY < ${t} && 0 <= coordX && coordX < ${e}) {
                  outputValue = getImage(batch, coordY, coordX, channel);
              } else {
                outputValue = float(${s});
              }
              return outputValue;
            }

            void main() {
              ivec4 coords = getOutputCoords();
              float outputValue;
              int batch = coords[0];
              int x = coords[2];
              int y = coords[1];
              int channel = coords[3];
              float xf = float(x);
              float yf = float(y);
              float a1 = getTransforms(batch, 0);
              float a2 = getTransforms(batch, 1);
              float a3 = getTransforms(batch, 2);
              float b1 = getTransforms(batch, 3);
              float b2 = getTransforms(batch, 4);
              float b3 = getTransforms(batch, 5);
              float c1 = getTransforms(batch, 6);
              float c2 = getTransforms(batch, 7);
              float projection = c1 * xf + c2 * yf + 1.0;
              if (projection == 0.0) {
                outputValue = float(${s});
              } else {
                float inX = (a1 * xf + a2 * yf + a3) / projection;
                float inY = (b1 * xf + b2 * yf + b3) / projection;
                float mapX = mapCoord(inX, float(${e}));
                float mapY = mapCoord(inY, float(${t}));

                if (${i} == 1) {
                  int coordY = int(round(mapY));
                  int coordX = int(round(mapX));
                  outputValue = readWithFillValue(batch, coordY, coordX,
                    channel);
                } else {
                  float yFloor = floor(mapY);
                  float xFloor = floor(mapX);
                  float yCeil = yFloor + 1.0;
                  float xCeil = xFloor + 1.0;
                  float valueYFloor = (xCeil - mapX) *
                  readWithFillValue(batch, int(yFloor), int(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, int(yFloor), int(xCeil), channel);
                  float valueYCeil = (xCeil - mapX) *
                  readWithFillValue(batch, int(yCeil), int(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, int(yCeil), int(xCeil), channel);
                  outputValue = (yCeil - mapY) * valueYFloor +
                  (mapY - yFloor) * valueYCeil;
                }
              }
              setOutput(outputValue);
            }
        `}}});function u9(r){let{inputs:t,backend:e,attrs:o}=r,{image:n,transforms:s}=t,{interpolation:a,fillMode:i,fillValue:c,outputShape:l}=o,[u,p,m,f]=n.shape,[d,x]=l!=null?l:[p,m],g=[u,d,x,f],y=new pg(p,m,a,i,c,g);return e.runWebGLProgram(y,[n,s],"float32")}var x3,y3=h(()=>{I();g3();x3={kernelName:Bc,backendName:"webgl",kernelFunc:u9}});function p9(r){let{inputs:t,attrs:e,backend:o}=r,{axis:n}=e,{x:s}=t;Ko(s,"unique"),console.warn("WARNING: ","UI might be locked temporarily as data is being downloaded");let a=o.readSync(s.dataId),{outputValues:i,outputShape:c,indices:l}=PR(a,n,s.shape,s.dtype);return[o.makeTensorInfo(c,s.dtype,i),o.makeTensorInfo([l.length],"int32",l)]}var b3,v3=h(()=>{I();Nt();Fr();b3={kernelName:Vc,backendName:"webgl",kernelFunc:p9}});function m9(r){let{inputs:t,backend:e,attrs:o}=r,{value:n}=t,{axis:s}=o;s<0&&(s+=n.shape.length);let a=n,i=a.shape.length,c=n.shape[s],l=new Array(i-1),u=0;for(let x=0;x<i;x++)x!==s&&(l[u++]=a.shape[x]);let p=[],m=new Array(i).fill(0),f=a.shape.slice();f[s]=1;let d=new Array(c);for(let x=0;x<d.length;x++){m[s]=x;let g=Io({inputs:{x:a},backend:e,attrs:{begin:m,size:f}}),y=J({inputs:{x:g},backend:e,attrs:{shape:l}});d[x]=y,p.push(g)}return p.forEach(x=>e.disposeIntermediateTensorInfo(x)),d}var w3,C3=h(()=>{I();Xt();ei();w3={kernelName:zc,backendName:"webgl",kernelFunc:m9}});var mg,S3=h(()=>{mg=class{constructor(t,e){this.variableNames=["x","segmentIds"];let o=t.windowSize,n=t.batchSize,s=t.inSize,a=t.numSegments,i=a*Math.ceil(s/o);this.outputShape=[n,i];let c="0.0",l="sumValue",u=Math.floor(o/4)*4,p=o%4,m=`
        sumValue += dot(values, segFilter);
    `,f="";s%o>0&&(f=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return initializationValue;
        }
      `);let d="";s%o>0&&(d=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return -1.0;
        }
      `),this.userCode=`
      const float initializationValue = ${c};

      float getValue(int batch, int inIdx) {
        ${f}
        return getX(batch, inIdx);
      }

      float getSegmentIdAtIndex(int inIdx) {
        ${d}
        return getSegmentIds(inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = int(floor(float(outIdx) / float(
          ${a})) * float(${o}));
        int currentSeg = int(mod(float(outIdx), float(${a})));

        float sumValue = 0.0;

        for (int i = 0; i < ${u}; i += 4) {
          int inIdx = inOffset + i;
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 2)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 3)) == currentSeg ? 1 : 0
          );

          ${m}
        }

        int inIdx = inOffset + ${u};
        if (${p===1}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            initializationValue,
            initializationValue,
            initializationValue
          );

          int inIdxSeg = int(getSegmentIdAtIndex(inIdx));

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            0,
            0,
            0
          );

          ${m}
        } else if (${p===2}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            initializationValue,
            initializationValue
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
              0,
              0
          );

          ${m}
        } else if (${p===3}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            initializationValue
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 2)) == currentSeg ? 1 : 0,
            0
          );

          ${m}
        }
        setOutput(${l});
      }
    `}}});function f9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,segmentIds:s}=t,{numSegments:a}=o,i=n.shape.length,c=[],l=0,u=k.getAxesPermutation([l],i),p=n;u!=null&&(p=re({inputs:{x:n},backend:e,attrs:{perm:u}}),c.push(p),l=k.getInnerMostAxes(1,i)[0]);let m=k.segment_util.computeOutShape(p.shape,l,a),f=b.sizeFromShape([p.shape[l]]),d=J({inputs:{x:p},backend:e,attrs:{shape:[-1,f]}});c.push(d);let x=ha(n.dtype),g=(S,R,A,_,D)=>{let L=S.shape[0],M=S.shape[1],V=k.segment_util.segOpComputeOptimalWindowSize(M,D),W={windowSize:V,inSize:M,batchSize:L,numSegments:D},G=new mg(W,R),K=e.compileAndRun(G,[S,A],_);if(c.push(K),K.shape[1]===D)return K;let U=Sv({backend:e,attrs:{start:0,stop:D,step:1,dtype:"float32"}}),j=Tv({inputs:{x:U},backend:e,attrs:{reps:[M/V]}});return c.push(U),c.push(j),g(K,R,j,_,D)},y=g(d,"unsortedSegmentSum",s,x,a),v=J({inputs:{x:y},backend:e,attrs:{shape:m}}),N=v;if(u!=null){c.push(v);let S=k.getUndoAxesPermutation(u);N=re({inputs:{x:N},backend:e,attrs:{perm:S}})}return c.forEach(S=>e.disposeIntermediateTensorInfo(S)),N}var N3,T3=h(()=>{I();S3();Nv();Xt();Iv();Vr();N3={kernelName:Gc,backendName:"webgl",kernelFunc:f9}});var d9,I3=h(()=>{I();CA();TA();kA();$A();_A();PA();MA();VA();KA();XA();YA();QA();t_();r_();n_();a_();c_();u_();m_();d_();y_();S_();T_();k_();$_();O_();M_();G_();bn();K_();Z0();tD();rD();sD();iD();lD();pD();fD();hD();yD();CD();ND();ID();$D();AD();DD();OD();MD();zD();WD();HD();qD();jD();ZD();sv();av();rF();sF();Gl();uF();fF();hF();bF();wF();SF();IF();uv();RF();_F();Qr();FF();gp();PF();MF();VF();P0();GF();UF();KF();XF();YF();QF();tO();rO();aO();lO();mv();dO();gO();yO();vO();CO();IO();RO();_O();FO();MO();VO();qO();zd();jO();ZO();JO();eP();X0();nP();cP();uP();Cv();hP();B0();xP();bP();wP();SP();Nv();Pl();hv();IP();EP();RP();Xt();FP();LP();zP();UP();XP();ZP();JP();eL();nL();iL();uL();mL();dL();gL();yL();vL();ei();bv();CL();NL();IL();EL();RL();_L();FL();PL();BL();zL();UL();KL();XL();ZL();JL();e3();o3();xv();hp();s3();i3();l3();Iv();h3();y3();Vr();v3();C3();T3();vv();d9=[wA,NA,IA,EA,AA,OA,LA,BA,HA,qA,jA,ZA,JA,e_,o_,s_,i_,l_,p_,f_,x_,C_,N_,I_,E_,F_,L_,z_,sA,H_,Z_,J_,eD,nD,aD,cD,uD,mD,dD,xD,wD,SD,TD,ED,RD,_D,FD,LD,VD,GD,UD,KD,XD,YD,QD,JD,eF,nF,iF,lF,mF,dF,yF,vF,CF,TF,EF,$F,AF,nA,DF,j_,OF,LF,BF,aA,zF,WF,HF,qF,jF,ZF,JF,eO,sO,cO,mO,fO,hO,xO,bO,wO,TO,$O,AO,DO,LO,BO,KO,lA,XO,YO,QO,tP,R_,oP,iP,lP,fP,dP,iA,gP,yP,vP,CP,NP,A_,GO,TP,kP,$P,mA,DP,PP,VP,WP,qP,YP,QP,tL,oL,aL,lL,pL,fL,hL,xL,bL,w_,HO,wL,SL,TL,kL,$L,AL,DL,OL,ML,VL,WL,HL,qL,YL,QL,t3,r3,UO,bA,n3,a3,c3,p3,d3,x3,vA,b3,w3,N3,sP];for(let r of d9)em(r)});var kv=h(()=>{oA();I3();});var k3=h(()=>{"use strict"});var h9,wp,E3=h(()=>{I();ft();h9=Ye.whereImpl,wp=class r extends Qo{nextDataId(){return r.nextDataId++}constructor(){super(),this.blockSize=48,this.firstUse=!0,this.data=new ps(this,ro())}write(t,e,o){this.firstUse&&(this.firstUse=!1,O().get("IS_NODE")&&k.warn(`
============================
Hi, looks like you are running TensorFlow.js in Node.js. To speed things up dramatically, install our node backend, visit https://github.com/tensorflow/tfjs-node for more details. 
============================`));let n={id:this.nextDataId()};return this.data.set(n,{values:t,dtype:o,refCount:1}),n}makeTensorInfo(t,e,o){let n;if(e==="string"&&o!=null&&o.length>0&&b.isString(o[0])){let s=o.map(a=>b.encodeString(a));n=this.write(s,t,e)}else n=this.write(o,t,e);return{dataId:n,shape:t,dtype:e}}refCount(t){return this.data.has(t)?this.data.get(t).refCount:0}incRef(t){let e=this.data.get(t);e.refCount++}decRef(t){if(this.data.has(t)){let e=this.data.get(t);e.refCount--}}move(t,e,o,n,s){this.data.set(t,{values:e,dtype:n,refCount:s})}numDataIds(){return this.data.numDataIds()}async read(t){return this.readSync(t)}readSync(t){let{dtype:e,complexTensorInfos:o}=this.data.get(t);if(e==="complex64"){let n=this.readSync(o.real.dataId),s=this.readSync(o.imag.dataId);return k.mergeRealAndImagArrays(n,s)}return b.convertBackendValuesAndArrayBuffer(this.data.get(t).values,e)}bufferSync(t){let e=this.readSync(t.dataId);if(t.dtype==="string")try{let o=e.map(n=>b.decodeString(n));return ut(t.shape,t.dtype,o)}catch{throw new Error("Failed to decode encoded string bytes into utf-8")}return ut(t.shape,t.dtype,e)}makeOutput(t,e,o){return ro().makeTensorFromTensorInfo(this.makeTensorInfo(e,o,t),this)}disposeData(t,e=!1){if(this.data.has(t)){if(this.data.get(t).refCount--,!e&&this.data.get(t).refCount>0)return!1;let{complexTensorInfos:o}=this.data.get(t);o!=null&&(this.disposeData(o.real.dataId,!0),this.disposeData(o.imag.dataId,!0)),this.data.delete(t)}return!0}disposeIntermediateTensorInfo(t){this.disposeData(t.dataId)}async time(t){let e=b.now();return t(),{kernelMs:b.now()-e}}memory(){return{unreliable:!0,reasons:["The reported memory is an upper bound. Due to automatic garbage collection, the true allocated memory may be less."]}}where(t){Y([t],"where");let e=this.readSync(t.dataId);return h9(t.shape,e)}dispose(){}floatPrecision(){return 32}epsilon(){return super.epsilon()}};wp.nextDataId=0});var $3=h(()=>{I();E3();mm("cpu",()=>new wp,1)});var Ev,R3,$v=h(()=>{I();Pt();Ev=yt("Elu",r=>r>=0?r:Math.exp(r)-1),R3={kernelName:"Elu",backendName:"cpu",kernelFunc:Ev}});function Rv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{alpha:s}=o;Y([n],"leakyRelu");let a=b.sizeFromShape(n.shape),i=e.data.get(n.dataId).values,c=b.getTypedArrayFromDType("float32",a);for(let l=0;l<i.length;l++)c[l]=i[l]<0?s*i[l]:i[l];return e.makeTensorInfo(n.shape,"float32",c)}var A3,Av=h(()=>{I();ft();A3={kernelName:ji,backendName:"cpu",kernelFunc:Rv}});function _v(r){let{inputs:t,backend:e}=r,{x:o,alpha:n}=t;Y([o,n],"prelu");let s=e.data.get(o.dataId).values,a=e.data.get(n.dataId).values,[i,c]=g9(o.shape,n.shape,s,a,"float32");return e.makeTensorInfo(c,"float32",i)}var g9,_3,Dv=h(()=>{I();ft();we();g9=Rt((r,t)=>r<0?t*r:r);_3={kernelName:uc,backendName:"cpu",kernelFunc:_v}});var Fv,D3,Ov=h(()=>{I();Pt();Fv=yt(qs,r=>Math.max(0,r)),D3={kernelName:qs,backendName:"cpu",kernelFunc:Fv}});var Pv,F3,Lv=h(()=>{I();Pt();Pv=yt(Xs,r=>Math.min(Math.max(0,r),6)),F3={kernelName:Xs,backendName:"cpu",kernelFunc:Pv}});function si(r,t,e,o,n){if(e==="linear")return Qe({inputs:{x:t},backend:r});if(e==="relu")return Fv({inputs:{x:t},backend:r});if(e==="elu")return Ev({inputs:{x:t},backend:r});if(e==="relu6")return Pv({inputs:{x:t},backend:r});if(e==="prelu")return _v({inputs:{x:t,alpha:o},backend:r});if(e==="leakyrelu")return Rv({inputs:{x:t},backend:r,attrs:{alpha:n}});if(e==="sigmoid")return m0({inputs:{x:t},backend:r});throw new Error(`Activation ${e} has not been implemented for the CPU backend.`)}var fg=h(()=>{$v();qo();Av();Dv();Ov();Lv();Sd();});function At(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{shape:s}=o,a=b.sizeFromShape(n.shape),i=b.inferFromImplicitShape(s,a),c=b.sizeFromShape(i);b.assert(a===c,()=>`The new shape (${i}) has ${c} elements and the old shape (${n.shape}) has ${a} elements. The new shape and old shape must have the same number of elements.`),e.incRef(n.dataId);let l=e.data.get(n.dataId);if(l.complexTensorInfos!=null){let u=l.complexTensorInfos.real,p=l.complexTensorInfos.imag;u.shape=i,p.shape=i}return{dataId:n.dataId,shape:i,dtype:n.dtype}}var O3,Ue=h(()=>{I();O3={kernelName:xc,backendName:"cpu",kernelFunc:At}});function Mv(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s}=t,{transposeA:a,transposeB:i}=o;Y([n,s],"matMul");let c=n.shape.length,l=s.shape.length,u=a?n.shape[c-2]:n.shape[c-1],p=i?s.shape[l-1]:s.shape[l-2],m=a?n.shape[c-1]:n.shape[c-2],f=i?s.shape[l-2]:s.shape[l-1],d=n.shape.slice(0,-2),x=s.shape.slice(0,-2),g=b.sizeFromShape(d),y=b.sizeFromShape(x),N=Mo.assertAndGetBroadcastShape(n.shape.slice(0,-2),s.shape.slice(0,-2)).concat([m,f]);b.assert(u===p,()=>`Error in matMul: inner shapes (${u}) and (${p}) of Tensors with shapes ${n.shape} and ${s.shape} and transposeA=${a} and transposeB=${i} must match.`);let S=a?[g,u,m]:[g,m,u],R=i?[y,f,p]:[y,p,f],A=At({inputs:{x:n},backend:e,attrs:{shape:S}}),_=At({inputs:{x:s},backend:e,attrs:{shape:R}}),D=a?A.shape[1]:A.shape[2],L=a?A.shape[2]:A.shape[1],M=i?_.shape[1]:_.shape[2],V=Math.max(g,y),W=e.data.get(A.dataId).values,G=e.data.get(_.dataId).values,K=b.computeStrides(A.shape),U=b.computeStrides(_.shape),[j,Z,q]=a?[K[0],1,K[1]]:[K[0],K[1],1],[Q,rt,et]=i?[1,U[1],U[0]]:[U[1],1,U[0]],st=L*M,ot=ut([V,L,M],A.dtype),at=ot.values,nt=e.blockSize;for(let lt=0;lt<V;lt++){let xt=lt%g,gt=lt%y;for(let ht=0;ht<L;ht+=nt){let Ct=Math.min(ht+nt,L);for(let It=0;It<M;It+=nt){let Mt=Math.min(It+nt,M);for(let Ht=0;Ht<D;Ht+=nt){let Zt=Math.min(Ht+nt,D);for(let Kt=ht;Kt<Ct;Kt++)for(let Ut=It;Ut<Mt;Ut++){let Qt=0;for(let jt=Ht;jt<Zt;jt++){let te=W[xt*j+Kt*Z+jt*q],Ne=G[jt*Q+Ut*rt+gt*et];Qt+=te*Ne}at[lt*st+(Kt*M+Ut)]+=Qt}}}}}return e.disposeIntermediateTensorInfo(A),e.disposeIntermediateTensorInfo(_),e.makeTensorInfo(N,ot.dtype,ot.values)}var P3,Bv=h(()=>{I();ft();Ue();P3={kernelName:yi,backendName:"cpu",kernelFunc:Mv}});function x9(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s,bias:a,preluActivationWeights:i}=t,{transposeA:c,transposeB:l,activation:u,leakyreluAlpha:p}=o,m,f,d,x=[];m=Mv({inputs:{a:n,b:s},attrs:{transposeA:c,transposeB:l},backend:e}),a&&(f=Xo({inputs:{a:m,b:a},backend:e}),x.push(m),m=f),u&&(d=si(e,m,u,i,p),x.push(m),m=d);for(let y of x)e.disposeIntermediateTensorInfo(y);return m}var L3,M3=h(()=>{I();fg();Xa();Bv();L3={kernelName:ia,backendName:"cpu",kernelFunc:x9}});var y9,B3,V3=h(()=>{I();Pt();y9=yt(hs,r=>Math.acos(r)),B3={kernelName:hs,backendName:"cpu",kernelFunc:y9}});var b9,z3,G3=h(()=>{I();Pt();b9=yt(gs,r=>Math.acosh(r)),z3={kernelName:gs,backendName:"cpu",kernelFunc:b9}});function v9(r){let{inputs:t,backend:e}=r,o=t;Y(t,"addN");let n=o.map(i=>e.data.get(i.dataId).values),s=ut(o[0].shape,o[0].dtype),a=s.values;for(let i=0;i<o.length;i++){let c=n[i];for(let l=0;l<a.length;l++)a[l]+=c[l]}return e.makeTensorInfo(s.shape,s.dtype,s.values)}var W3,U3=h(()=>{I();ft();W3={kernelName:fi,backendName:"cpu",kernelFunc:v9}});function w9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;Y(n,"all");let i=b.parseAxisParam(s,n.shape),c=i,l=k.getAxesPermutation(c,n.shape.length),u=n;l!=null&&(u=ce({inputs:{x:n},backend:e,attrs:{perm:l}}),c=k.getInnerMostAxes(c.length,n.shape.length)),k.assertAxesAreInnerMostDims("all",c,u.shape.length);let[p,m]=k.computeOutAndReduceShapes(u.shape,c),f=b.sizeFromShape(m),d=b.makeZerosTypedArray(b.sizeFromShape(p),u.dtype),x=e.data.get(u.dataId).values;for(let y=0;y<d.length;++y){let v=y*f,N=x[v];for(let S=0;S<f;++S){let R=x[v+S];N=N&&R}d[y]=N}l!=null&&e.disposeIntermediateTensorInfo(u);let g=e.makeTensorInfo(p,u.dtype,d);if(a){let y=k.expandShapeToKeepDim(p,i),v=At({inputs:{x:g},backend:e,attrs:{shape:y}});return e.disposeIntermediateTensorInfo(g),v}return g}var H3,K3=h(()=>{I();ft();Ue();Or();H3={kernelName:"All",backendName:"cpu",kernelFunc:w9}});function C9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;Y(n,"any");let i=b.parseAxisParam(s,n.shape),c=i,l=k.getAxesPermutation(c,n.shape.length),u=n;l!=null&&(u=ce({inputs:{x:n},backend:e,attrs:{perm:l}}),c=k.getInnerMostAxes(c.length,n.shape.length)),k.assertAxesAreInnerMostDims("any",c,u.shape.length);let[p,m]=k.computeOutAndReduceShapes(u.shape,c),f=b.sizeFromShape(m),d=b.makeZerosTypedArray(b.sizeFromShape(p),u.dtype),x=e.data.get(u.dataId).values;for(let y=0;y<d.length;++y){let v=y*f,N=x[v];for(let S=0;S<f;++S){let R=x[v+S];N=N||R}d[y]=N}l!=null&&e.disposeIntermediateTensorInfo(u);let g=e.makeTensorInfo(p,u.dtype,d);if(a){let y=k.expandShapeToKeepDim(p,i),v=At({inputs:{x:g},backend:e,attrs:{shape:y}});return e.disposeIntermediateTensorInfo(g),v}return g}var q3,X3=h(()=>{I();ft();Ue();Or();q3={kernelName:"Any",backendName:"cpu",kernelFunc:C9}});function S9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o;Y(n,"argMax");let a=b.parseAxisParam(s,n.shape),i=k.getAxesPermutation(a,n.shape.length),c=n,l=[];i!=null&&(c=ce({inputs:{x:n},backend:e,attrs:{perm:i}}),l.push(c),a=k.getInnerMostAxes(a.length,c.shape.length)),a=[a[0]],k.assertAxesAreInnerMostDims("argMax",a,c.shape.length);let[u,p]=k.computeOutAndReduceShapes(c.shape,a),m=b.sizeFromShape(u),f=b.makeZerosTypedArray(m,"int32"),d=b.sizeFromShape(p),x=e.data.get(c.dataId).values;for(let g=0;g<f.length;++g){let y=g*d,v=x[y],N=0;for(let S=0;S<d;++S){let R=x[y+S];R>v&&(v=R,N=S)}f[g]=N}return l.forEach(g=>e.disposeIntermediateTensorInfo(g)),e.makeTensorInfo(u,"int32",f)}var j3,Y3=h(()=>{I();ft();Or();j3={kernelName:di,backendName:"cpu",kernelFunc:S9}});function N9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o;Y(n,"argMin");let a=b.parseAxisParam(s,n.shape),i=k.getAxesPermutation(a,n.shape.length),c=n,l=[];i!=null&&(c=ce({inputs:{x:n},backend:e,attrs:{perm:i}}),l.push(c),a=k.getInnerMostAxes(a.length,c.shape.length)),a=[a[0]],k.assertAxesAreInnerMostDims("argMin",a,c.shape.length);let[u,p]=k.computeOutAndReduceShapes(c.shape,a),m=b.sizeFromShape(u),f=b.makeZerosTypedArray(m,"int32"),d=b.sizeFromShape(p),x=e.data.get(c.dataId).values;for(let g=0;g<f.length;++g){let y=g*d,v=x[y],N=0;for(let S=0;S<d;++S){let R=x[y+S];R<v&&(v=R,N=S)}f[g]=N}return l.forEach(g=>e.disposeIntermediateTensorInfo(g)),e.makeTensorInfo(u,"int32",f)}var Z3,Q3=h(()=>{I();ft();Or();Z3={kernelName:hi,backendName:"cpu",kernelFunc:N9}});var T9,J3,tM=h(()=>{I();Pt();T9=yt(xs,r=>Math.asin(r)),J3={kernelName:xs,backendName:"cpu",kernelFunc:T9}});var I9,eM,rM=h(()=>{I();Pt();I9=yt(ys,r=>Math.asinh(r)),eM={kernelName:ys,backendName:"cpu",kernelFunc:I9}});var k9,oM,nM=h(()=>{I();Pt();k9=yt(bs,r=>Math.atan(r)),oM={kernelName:bs,backendName:"cpu",kernelFunc:k9}});var E9,$9,sM,aM=h(()=>{I();we();$e();E9=Rt((r,t)=>Math.atan2(r,t)),$9=Ot(ws,E9),sM={kernelName:ws,backendName:"cpu",kernelFunc:$9}});var R9,iM,cM=h(()=>{I();Pt();R9=yt(vs,r=>Math.atanh(r)),iM={kernelName:vs,backendName:"cpu",kernelFunc:R9}});function Ul(r,t,e,o,n,s){let a=n.strideHeight,i=n.strideWidth,c=n.dilationHeight,l=n.dilationWidth,u=n.effectiveFilterHeight,p=n.effectiveFilterWidth,m=n.padInfo.top,f=n.padInfo.left,d=s==="max"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,x=ut(n.outShape,e),g=x.values,y=n.outShape[1]*n.outShape[2]*n.outShape[3],v=n.outShape[2]*n.outShape[3],N=n.outShape[3];for(let S=0;S<n.batchSize;++S){let R=S*y,A=S*o[0];for(let _=0;_<n.inChannels;++_)for(let D=0;D<n.outHeight;++D){let L=D*a-m,M=Math.max(0,L),V=Math.min(n.inHeight,u+L),W=R+D*v;for(let G=0;G<n.outWidth;++G){let K=G*i-f,U=Math.max(0,K),j=Math.min(n.inWidth,p+K),Z=d,q=0,Q=0;for(let et=M;et<V;et+=c){let st=A+et*o[1];for(let ot=U;ot<j;ot+=l){let at=st+ot*o[2],nt=r[at+_];s==="max"&&nt>Z?Z=nt:s==="avg"&&(q+=nt,Q++)}if(isNaN(Z))break}let rt=W+G*N+_;g[rt]=s==="avg"?q/Q:Z}}}return x}function dg(r,t,e,o,n=!1,s=!1){let a=ut(o.outShape,"int32"),i=o.strideHeight,c=o.strideWidth,l=o.dilationHeight,u=o.dilationWidth,p=o.effectiveFilterHeight,m=o.effectiveFilterWidth,f=o.padInfo.top,d=o.padInfo.left,x=ut(t,e,r);for(let g=0;g<o.batchSize;++g)for(let y=0;y<o.inChannels;++y)for(let v=0;v<o.outHeight;++v){let N=v*i-f,S=N;for(;S<0;)S+=l;let R=Math.min(o.inHeight,p+N);for(let A=0;A<o.outWidth;++A){let _=A*c-d,D=_;for(;D<0;)D+=u;let L=Math.min(o.inWidth,m+_),M=Number.NEGATIVE_INFINITY,V=-1;for(let W=S;W<R;W+=l){let G=W-N;for(let K=D;K<L;K+=u){let U=K-_,j=x.get(g,W,K,y);j>M&&(M=j,n?V=s?((g*o.inHeight+W)*o.inWidth+K)*o.inChannels+y:(W*o.inWidth+K)*o.inChannels+y:V=G*m+U)}}a.set(V,g,v,A,y)}}return a}function hg(r,t,e,o,n,s){let a=n.strideDepth,i=n.strideHeight,c=n.strideWidth,l=n.dilationDepth,u=n.dilationHeight,p=n.dilationWidth,m=n.effectiveFilterDepth,f=n.effectiveFilterHeight,d=n.effectiveFilterWidth,x=n.padInfo.front,g=n.padInfo.top,y=n.padInfo.left,v=s==="max"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,N=ut(n.outShape,e),S=N.values,R=n.outShape[1]*n.outShape[2]*n.outShape[3]*n.outShape[4],A=n.outShape[2]*n.outShape[3]*n.outShape[4],_=n.outShape[3]*n.outShape[4],D=n.outShape[4];for(let L=0;L<n.batchSize;++L){let M=L*R,V=L*o[0];for(let W=0;W<n.inChannels;++W)for(let G=0;G<n.outDepth;++G){let K=G*a-x,U=K;for(;U<0;)U+=l;let j=Math.min(n.inDepth,m+K),Z=M+G*A;for(let q=0;q<n.outHeight;++q){let Q=q*i-g,rt=Q;for(;rt<0;)rt+=u;let et=Math.min(n.inHeight,f+Q),st=Z+q*_;for(let ot=0;ot<n.outWidth;++ot){let at=ot*c-y,nt=at;for(;nt<0;)nt+=p;let lt=Math.min(n.inWidth,d+at),xt=st+ot*D,gt=v,ht=0,Ct=0;for(let Mt=U;Mt<j;Mt+=l){let Ht=V+Mt*o[1];for(let Zt=rt;Zt<et;Zt+=u){let Kt=Ht+Zt*o[2];for(let Ut=nt;Ut<lt;Ut+=p){let Qt=Kt+Ut*o[3],jt=r[Qt+W];if(s==="max"&&jt>gt?gt=jt:s==="avg"&&(ht+=jt,Ct++),isNaN(gt))break}if(isNaN(gt))break}if(isNaN(gt))break}let It=xt+W;S[It]=s==="avg"?ht/Math.max(Ct,1):gt}}}}return N}function lM(r,t){let e=ut(t.outShape,"int32"),o=t.strideDepth,n=t.strideHeight,s=t.strideWidth,a=t.dilationDepth,i=t.dilationHeight,c=t.dilationWidth,l=t.effectiveFilterDepth,u=t.effectiveFilterHeight,p=t.effectiveFilterWidth,m=t.padInfo.front,f=t.padInfo.top,d=t.padInfo.left;for(let x=0;x<t.batchSize;++x)for(let g=0;g<t.inChannels;++g)for(let y=0;y<t.outDepth;++y){let v=y*o-m,N=v;for(;N<0;)N+=a;let S=Math.min(t.inDepth,l+v);for(let R=0;R<t.outHeight;++R){let A=R*n-f,_=A;for(;_<0;)_+=i;let D=Math.min(t.inHeight,u+A);for(let L=0;L<t.outWidth;++L){let M=L*s-d,V=M;for(;V<0;)V+=c;let W=Math.min(t.inWidth,p+M),G=Number.NEGATIVE_INFINITY,K=-1;for(let U=N;U<S;U+=a){let j=U-v;for(let Z=_;Z<D;Z+=i){let q=Z-A;for(let Q=V;Q<W;Q+=c){let rt=Q-M,et=r.get(x,U,Z,Q,g);et>=G&&(G=et,K=j*u*p+q*u+rt)}}}e.set(K,x,y,R,L,g)}}}return e}var as=h(()=>{I();});function A9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;Y(n,"avgPool");let{filterSize:s,strides:a,pad:i,dimRoundingMode:c}=o,l=1;b.assert(k.eitherStridesOrDilationsAreOne(a,l),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${a} and dilations '${l}'`);let u=k.computePool2DInfo(n.shape,s,a,l,i,c),p;if(u.filterWidth===1&&u.filterHeight===1&&b.arraysEqual(u.inShape,u.outShape))p=Qe({inputs:{x:n},backend:e});else{let m=e.data.get(n.dataId).values,f=b.computeStrides(n.shape),d=Ul(m,n.shape,n.dtype,f,u,"avg");p=e.makeTensorInfo(u.outShape,n.dtype,d.values)}return p}var uM,pM=h(()=>{I();ft();as();qo();uM={kernelName:gi,backendName:"cpu",kernelFunc:A9}});function _9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:a,pad:i,dimRoundingMode:c,dataFormat:l}=o;Y(n,"avgPool3d");let u=k.computePool3DInfo(n.shape,s,a,1,i,c,l),p=e.data.get(n.dataId).values,m=hg(p,n.shape,n.dtype,b.computeStrides(n.shape),u,"avg");return e.makeTensorInfo(m.shape,"float32",m.values)}var mM,fM=h(()=>{I();ft();as();mM={kernelName:xi,backendName:"cpu",kernelFunc:_9}});function D9(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,{filterSize:a,strides:i,pad:c,dimRoundingMode:l}=o;Y([n,s],"avgPool3DGrad");let u=k.computePool3DInfo(s.shape,a,i,1,c,l),p=u.strideDepth,m=u.strideHeight,f=u.strideWidth,d=u.filterDepth,x=u.filterHeight,g=u.filterWidth,y=u.dilationDepth,v=u.dilationHeight,N=u.dilationWidth,S=u.effectiveFilterDepth,R=u.effectiveFilterHeight,A=u.effectiveFilterWidth,_=S-1-u.padInfo.front,D=A-1-u.padInfo.left,L=R-1-u.padInfo.top,M=ut(s.shape,"float32"),V=1/(d*x*g),W=e.bufferSync(n);for(let G=0;G<u.batchSize;++G)for(let K=0;K<u.inChannels;++K)for(let U=0;U<u.inDepth;++U)for(let j=0;j<u.inHeight;++j)for(let Z=0;Z<u.inWidth;++Z){let q=U-_,Q=j-L,rt=Z-D,et=0;for(let st=0;st<S;st+=y){let ot=(q+st)/p;if(!(ot<0||ot>=u.outDepth||Math.floor(ot)!==ot))for(let at=0;at<R;at+=v){let nt=(Q+at)/m;if(!(nt<0||nt>=u.outHeight||Math.floor(nt)!==nt))for(let lt=0;lt<A;lt+=N){let xt=(rt+lt)/f;if(xt<0||xt>=u.outWidth||Math.floor(xt)!==xt)continue;let gt=W.get(G,ot,nt,xt,K);et+=gt}}}M.set(et*V,G,U,j,Z,K)}return e.makeTensorInfo(M.shape,M.dtype,M.values)}var dM,hM=h(()=>{I();ft();dM={kernelName:Up,backendName:"cpu",kernelFunc:D9}});function F9(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,a=s;Y([n,s],"avgPoolGrad");let{filterSize:i,strides:c,pad:l}=o,u=k.computePool2DInfo(a.shape,i,c,1,l),p=u.strideHeight,m=u.strideWidth,f=u.filterHeight,d=u.filterWidth,x=u.dilationHeight,g=u.dilationWidth,y=u.effectiveFilterHeight,v=u.effectiveFilterWidth,N=v-1-u.padInfo.left,S=y-1-u.padInfo.top,R=ut(a.shape,"float32"),A=1/(f*d),_=e.data.get(n.dataId).values,D=ut(n.shape,"float32",_);for(let L=0;L<u.batchSize;++L)for(let M=0;M<u.inChannels;++M)for(let V=0;V<u.inHeight;++V)for(let W=0;W<u.inWidth;++W){let G=V-S,K=W-N,U=0;for(let j=0;j<y;j+=x){let Z=(G+j)/p;if(!(Z<0||Z>=u.outHeight||Math.floor(Z)!==Z))for(let q=0;q<v;q+=g){let Q=(K+q)/m;if(Q<0||Q>=u.outWidth||Math.floor(Q)!==Q)continue;let rt=D.get(L,Z,Q,M);U+=rt}}R.set(U*A,L,V,W,M)}return e.makeTensorInfo(R.shape,R.dtype,R.values)}var gM,xM=h(()=>{I();ft();gM={kernelName:Wp,backendName:"cpu",kernelFunc:F9}});function O9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,scale:s,offset:a,mean:i,variance:c}=t;b.assert(i.shape.length===c.shape.length,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),b.assert(a==null||i.shape.length===a.shape.length,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),b.assert(s==null||i.shape.length===s.shape.length,()=>"Batch normalization gradient requires mean and scale to have equal ranks."),Y([n,i,c,s,a],"batchNorm");let{varianceEpsilon:l}=o;l==null&&(l=.001);let u=e.data.get(n.dataId).values,p=e.data.get(i.dataId).values,m=e.data.get(c.dataId).values,f=s?e.data.get(s.dataId).values:new Float32Array([1]),d=a?e.data.get(a.dataId).values:new Float32Array([0]),x=new Float32Array(u.length),g=d.length,y=f.length,v=m.length,N=p.length,S=0,R=0,A=0,_=0;for(let D=0;D<u.length;++D)x[D]=d[S++]+(u[D]-p[R++])*f[A++]/Math.sqrt(m[_++]+l),S>=g&&(S=0),R>=N&&(R=0),A>=y&&(A=0),_>=v&&(_=0);return e.makeTensorInfo(n.shape,n.dtype,x)}var yM,bM=h(()=>{I();ft();yM={kernelName:Ui,backendName:"cpu",kernelFunc:O9}});function P9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,crops:a}=o;Y([n],"batchToSpaceND");let i=s.reduce((y,v)=>y*v),c=k.getReshaped(n.shape,s,i),l=k.getPermuted(c.length,s.length),u=k.getReshapedPermuted(n.shape,s,i),p=k.getSliceBeginCoords(a,s.length),m=k.getSliceSize(u,a,s.length),f=At({inputs:{x:n},backend:e,attrs:{shape:c}}),d=ce({inputs:{x:f},backend:e,attrs:{perm:l}}),x=At({inputs:{x:d},backend:e,attrs:{shape:u}}),g=po({inputs:{x},backend:e,attrs:{begin:p,size:m}});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(x),g}var vM,wM=h(()=>{I();ft();Ue();ts();Or();vM={kernelName:bi,backendName:"cpu",kernelFunc:P9}});function L9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:a}=o,i=e.data.get(n.dataId).values,c=e.data.get(s.dataId).values,l=$l(i,c,s.dtype,s.shape,a);return e.makeTensorInfo([a],s.dtype,l)}var CM,SM=h(()=>{I();ud();CM={kernelName:vi,backendName:"cpu",kernelFunc:L9}});function M9(r){let{inputs:t,backend:e}=r,{s0:o,s1:n}=t,s=e.data.get(o.dataId).values,a=e.data.get(n.dataId).values,i=k.assertAndGetBroadcastShape(Array.from(s),Array.from(a));return e.makeTensorInfo([i.length],"int32",Int32Array.from(i))}var NM,TM=h(()=>{I();NM={kernelName:wi,backendName:"cpu",kernelFunc:M9}});var B9,IM,kM=h(()=>{I();Pt();B9=yt(Ns,(r,t)=>{let e=t;return r>e.clipValueMax?e.clipValueMax:r<e.clipValueMin?e.clipValueMin:r}),IM={kernelName:Ns,backendName:"cpu",kernelFunc:B9}});var V9,EM,$M=h(()=>{I();V9=r=>{let{x:t}=r.inputs,e=r.backend,o=new Float32Array(b.sizeFromShape(t.shape)),n=e.data.get(t.dataId),s=n.complexTensorInfos.real,a=n.complexTensorInfos.imag,i=e.data.get(s.dataId).values,c=e.data.get(a.dataId).values;for(let l=0;l<i.length;l++){let u=i[l],p=c[l];o[l]=Math.hypot(u,p)}return e.makeOutput(o,t.shape,"float32")},EM={kernelName:Si,backendName:"cpu",kernelFunc:V9}});function Zo(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.data.get(o.dataId).complexTensorInfos.imag,s=e.data.get(n.dataId).values;return e.makeTensorInfo(n.shape,n.dtype,s)}var RM,Hl=h(()=>{I();RM={kernelName:Xi,backendName:"cpu",kernelFunc:Zo}});function is(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o,s=b.parseAxisParam(n,t[0].shape)[0],a=t.map(x=>x.shape);k.assertParamsConsistent(a,s);let i=k.computeOutShape(t.map(x=>x.shape),s);if(b.sizeFromShape(i)===0)return e.makeTensorInfo(i,t[0].dtype,[]);let c=t.filter(x=>b.sizeFromShape(x.shape)>0);if(c.length===1)return Qe({inputs:{x:c[0]},backend:e});if(c[0].dtype==="complex64"){let x=c.map(S=>co({inputs:{input:S},backend:e})),g=c.map(S=>Zo({inputs:{input:S},backend:e})),y=is({inputs:x,backend:e,attrs:{axis:s}}),v=is({inputs:g,backend:e,attrs:{axis:s}}),N=Ee({inputs:{real:y,imag:v},backend:e});return x.forEach(S=>e.disposeIntermediateTensorInfo(S)),g.forEach(S=>e.disposeIntermediateTensorInfo(S)),e.disposeIntermediateTensorInfo(y),e.disposeIntermediateTensorInfo(v),N}let l=c.map(x=>{let y=[-1,b.sizeFromShape(x.shape.slice(s))];return At({inputs:{x},backend:e,attrs:{shape:y}})}),u=l.map(x=>({vals:e.data.get(x.dataId).values,shape:x.shape}));i=k.computeOutShape(l.map(x=>x.shape),1);let p=l[0].shape[0]===1,m=pd(u,i,t[0].dtype,p),f=k.computeOutShape(c.map(x=>x.shape),s),d=e.makeTensorInfo(f,t[0].dtype,m);return l.forEach(x=>e.disposeIntermediateTensorInfo(x)),d}var AM,gg=h(()=>{I();yn();Nb();qo();Hl();Ka();Ue();AM={kernelName:Ni,backendName:"cpu",kernelFunc:is}});function Vv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dataFormat:c,dilations:l,dimRoundingMode:u}=o;Y([n,s],"conv2d");let p=k.convertConv2DDataFormat(c),m=k.computeConv2DInfo(n.shape,s.shape,a,l,i,u,!1,p),f=m.filterHeight,d=m.filterWidth,x=m.dilationHeight,g=m.dilationWidth,y=m.padInfo.left,v=m.padInfo.top,N=m.dataFormat==="channelsLast",S=new Bt(m.outShape,n.dtype),R=b.computeStrides(n.shape),A=b.computeStrides(s.shape),_=R[0],D=N?R[1]:R[2],L=N?R[2]:1,M=N?1:R[1],V=S.strides[0],W=N?S.strides[1]:S.strides[2],G=N?S.strides[2]:1,K=N?1:S.strides[1],U=e.data.get(n.dataId).values,j=e.data.get(s.dataId).values,Z=S.values;for(let q=0;q<m.batchSize;++q){let Q=q*_,rt=q*V;for(let et=0;et<m.outHeight;++et){let st=rt+et*W,ot=et*m.strideHeight-v;for(let at=0;at<f;++at){let nt=ot+at*x;if(nt<0||nt>=m.inHeight)continue;let lt=at*A[0],xt=Q+nt*D;for(let gt=0;gt<m.outWidth;++gt){let ht=st+gt*G,Ct=gt*m.strideWidth-y;for(let It=0;It<d;++It){let Mt=Ct+It*g;if(Mt<0||Mt>=m.inWidth)continue;let Ht=lt+It*A[1],Zt=xt+Mt*L,Kt=Ht;for(let Ut=0;Ut<m.inChannels;++Ut){let Qt=U[Zt+Ut*M];for(let jt=0;jt<m.outChannels;++jt)Z[ht+jt*K]+=Qt*j[Kt+jt];Kt+=m.outChannels}}}}}}return e.makeTensorInfo(S.shape,S.dtype,Z)}var _M,zv=h(()=>{I();ft();_M={kernelName:Ti,backendName:"cpu",kernelFunc:Vv}});function z9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,pad:i,dataFormat:c,dimRoundingMode:l,filterShape:u}=o;Y([n,s],"conv2dBackpropFilter");let p=k.convertConv2DDataFormat(c),m=k.computeConv2DInfo(n.shape,u,a,1,i,l,!1,p),{strideHeight:f,strideWidth:d,filterHeight:x,filterWidth:g}=m,y=m.dataFormat==="channelsLast",v=new Bt(m.filterShape,"float32"),N=m.padInfo.left,S=m.padInfo.top,R=e.data.get(n.dataId).values,A=e.data.get(s.dataId).values,_=new Bt(n.shape,n.dtype,R),D=new Bt(s.shape,s.dtype,A);for(let L=0;L<x;++L){let M=Math.max(0,Math.ceil((S-L)/f)),V=Math.min(m.outHeight,(m.inHeight+S-L)/f);for(let W=0;W<g;++W){let G=Math.max(0,Math.ceil((N-W)/d)),K=Math.min(m.outWidth,(m.inWidth+N-W)/d);for(let U=0;U<m.inChannels;++U)for(let j=0;j<m.outChannels;++j){let Z=0;for(let q=0;q<m.batchSize;++q)for(let Q=M;Q<V;++Q){let rt=L+Q*f-S;for(let et=G;et<K;++et){let st=W+et*d-N;y?Z+=_.get(q,rt,st,U)*D.get(q,Q,et,j):Z+=_.get(q,U,rt,st)*D.get(q,j,Q,et)}}v.set(Z,L,W,U,j)}}}return e.makeTensorInfo(v.shape,v.dtype,v.values)}var DM,FM=h(()=>{I();ft();DM={kernelName:Ii,backendName:"cpu",kernelFunc:z9}});function G9(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{inputShape:a,strides:i,pad:c,dataFormat:l,dimRoundingMode:u}=o;Y([n,s],"conv2dBackpropInput");let p=b.computeStrides(s.shape),m=b.computeStrides(n.shape),f=k.convertConv2DDataFormat(l),d=k.computeConv2DInfo(a,s.shape,i,1,c,u,!1,f),x=new Bt(d.inShape,"float32"),g=x.values,y=e.data.get(n.dataId).values,v=e.data.get(s.dataId).values,[N,S,R]=p,{batchSize:A,filterHeight:_,filterWidth:D,inChannels:L,inHeight:M,inWidth:V,outChannels:W,outHeight:G,outWidth:K,strideHeight:U,strideWidth:j}=d;f=d.dataFormat;let Z=_-1-d.padInfo.top,q=D-1-d.padInfo.left,Q=f==="channelsLast",rt=x.strides[0],et=Q?x.strides[1]:x.strides[2],st=Q?x.strides[2]:1,ot=Q?1:x.strides[1],at=m[0],nt=Q?m[1]:m[2],lt=Q?m[2]:1,xt=Q?1:m[1];for(let gt=0;gt<A;++gt)for(let ht=0;ht<L;++ht)for(let Ct=0;Ct<M;++Ct){let It=Ct-Z,Mt=Math.max(0,Math.ceil(It/U)),Ht=Math.min(G,(_+It)/U);for(let Zt=0;Zt<V;++Zt){let Kt=Zt-q,Ut=Math.max(0,Math.ceil(Kt/j)),Qt=Math.min(K,(D+Kt)/j),jt=0;for(let Ne=Mt;Ne<Ht;++Ne){let Te=Ne*U-It;for(let le=Ut;le<Qt;++le){let $o=le*j-Kt,Tr=at*gt+nt*Ne+lt*le,He=N*(_-1-Te)+S*(D-1-$o)+R*ht;for(let Gr=0;Gr<W;++Gr){let Wr=y[Tr+xt*Gr],Ro=v[He+Gr];jt+=Wr*Ro}}}let te=rt*gt+et*Ct+st*Zt+ot*ht;g[te]=jt}}return e.makeTensorInfo(x.shape,x.dtype,x.values)}var OM,PM=h(()=>{I();ft();OM={kernelName:ki,backendName:"cpu",kernelFunc:G9}});function W9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dilations:c}=o;Y([n,s],"conv3d");let l=k.computeConv3DInfo(n.shape,s.shape,a,c,i),{filterDepth:u,filterHeight:p,filterWidth:m,dilationDepth:f,dilationHeight:d,dilationWidth:x,padInfo:g}=l,y=g.front,v=g.left,N=g.top,S=new Bt(l.outShape,n.dtype),R=e.data.get(n.dataId).values,A=e.data.get(s.dataId).values,_=S.values,D=b.computeStrides(n.shape),L=b.computeStrides(s.shape);for(let M=0;M<l.batchSize;++M){let V=M*D[0],W=M*S.strides[0];for(let G=0;G<l.outDepth;++G){let K=W+G*S.strides[1],U=G*l.strideDepth-y;for(let j=0;j<u;++j){let Z=U+j*f;if(Z<0||Z>=l.inDepth)continue;let q=j*L[0],Q=V+Z*D[1];for(let rt=0;rt<l.outHeight;++rt){let et=K+rt*S.strides[2],st=rt*l.strideHeight-N;for(let ot=0;ot<p;++ot){let at=st+ot*d;if(at<0||at>=l.inHeight)continue;let nt=q+ot*L[1],lt=Q+at*D[2];for(let xt=0;xt<l.outWidth;++xt){let gt=et+xt*l.outChannels,ht=xt*l.strideWidth-v;for(let Ct=0;Ct<m;++Ct){let It=ht+Ct*x;if(It<0||It>=l.inWidth)continue;let Mt=nt+Ct*L[2],Ht=lt+It*l.inChannels,Zt=Mt;for(let Kt=0;Kt<l.inChannels;++Kt){let Ut=R[Ht+Kt];for(let Qt=0;Qt<l.outChannels;++Qt)_[gt+Qt]+=Ut*A[Zt+Qt];Zt+=l.outChannels}}}}}}}}return e.makeTensorInfo(S.shape,S.dtype,S.values)}var LM,MM=h(()=>{I();ft();LM={kernelName:Ei,backendName:"cpu",kernelFunc:W9}});function U9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,pad:i,filterShape:c}=o;Y([n,s],"conv3dBackpropFilterV2");let l=b.computeStrides(n.shape),u=b.computeStrides(s.shape),p=k.computeConv3DInfo(n.shape,c,a,1,i),m=p.strideDepth,f=p.strideHeight,d=p.strideWidth,x=p.filterDepth,g=p.filterHeight,y=p.filterWidth,v=new Bt(p.filterShape,"float32"),N=v.values,[S,R,A,_]=v.strides,D=e.data.get(s.dataId).values,[L,M,V,W]=u,G=e.data.get(n.dataId).values,[K,U,j,Z]=l,q=p.padInfo.front,Q=p.padInfo.left,rt=p.padInfo.top;for(let et=0;et<x;++et){let st=Math.max(0,Math.ceil((q-et)/m)),ot=Math.min(p.outDepth,(p.inDepth+q-et)/m),at=et*S;for(let nt=0;nt<g;++nt){let lt=Math.max(0,Math.ceil((rt-nt)/f)),xt=Math.min(p.outHeight,(p.inHeight+rt-nt)/f),gt=nt*R+at;for(let ht=0;ht<y;++ht){let Ct=Math.max(0,Math.ceil((Q-ht)/d)),It=Math.min(p.outWidth,(p.inWidth+Q-ht)/d),Mt=ht*A+gt;for(let Ht=0;Ht<p.inChannels;++Ht){let Zt=Ht*_+Mt;for(let Kt=0;Kt<p.outChannels;++Kt){let Ut=0;for(let Qt=0;Qt<p.batchSize;++Qt){let jt=Qt*K,te=Qt*L;for(let Ne=st;Ne<ot;++Ne){let le=(et+Ne*m-q)*U+jt,$o=Ne*M+te;for(let Tr=lt;Tr<xt;++Tr){let Gr=(nt+Tr*f-rt)*j+le,Wr=Tr*V+$o;for(let Ro=Ct;Ro<It;++Ro){let Zl=(ht+Ro*d-Q)*Z+Gr,Ql=Ro*W+Wr;Ut+=G[Zl+Ht]*D[Ql+Kt]}}}}N[Zt+Kt]=Ut}}}}}return e.makeTensorInfo(v.shape,v.dtype,v.values)}var BM,VM=h(()=>{I();ft();BM={kernelName:Hp,backendName:"cpu",kernelFunc:U9}});function H9(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{pad:a,strides:i,inputShape:c}=o;Y([n],"conv3dBackpropInputV2");let l=b.computeStrides(n.shape),u=b.computeStrides(s.shape),p=k.computeConv3DInfo(c,s.shape,i,1,a),m=new Bt(p.inShape,"float32"),f=m.values,[d,x,g,y]=m.strides,v=e.data.get(n.dataId).values,[N,S,R,A]=l,_=e.data.get(s.dataId).values,[D,L,M,V]=u,{batchSize:W,filterDepth:G,filterHeight:K,filterWidth:U,inChannels:j,inDepth:Z,inHeight:q,inWidth:Q,outChannels:rt,outDepth:et,outHeight:st,outWidth:ot,strideDepth:at,strideHeight:nt,strideWidth:lt}=p,xt=G-1-p.padInfo.front,gt=K-1-p.padInfo.top,ht=U-1-p.padInfo.left;for(let Ct=0;Ct<W;++Ct)for(let It=0;It<j;++It)for(let Mt=0;Mt<Z;++Mt){let Ht=Mt-xt,Zt=Math.max(0,Math.ceil(Ht/at)),Kt=Math.min(et,(G+Ht)/at);for(let Ut=0;Ut<q;++Ut){let Qt=Ut-gt,jt=Math.max(0,Math.ceil(Qt/nt)),te=Math.min(st,(K+Qt)/nt);for(let Ne=0;Ne<Q;++Ne){let Te=Ne-ht,le=Math.max(0,Math.ceil(Te/lt)),$o=Math.min(ot,(U+Te)/lt),Tr=0;for(let He=Zt;He<Kt;++He){let Gr=He*at-Ht;for(let Wr=jt;Wr<te;++Wr){let Ro=Wr*nt-Qt;for(let us=le;us<$o;++us){let Zl=us*lt-Te,Ql=N*Ct+S*He+R*Wr+A*us,tr=D*(G-1-Gr)+L*(K-1-Ro)+M*(U-1-Zl)+V*It;for(let Ir=0;Ir<rt;++Ir){let Mp=v[Ql+Ir],Bp=_[tr+Ir];Tr+=Mp*Bp}}}}f[d*Ct+x*Mt+g*Ut+y*Ne+It]=Tr}}}return e.makeTensorInfo(m.shape,m.dtype,m.values)}var zM,GM=h(()=>{I();ft();zM={kernelName:$i,backendName:"cpu",kernelFunc:H9}});var K9,WM,UM=h(()=>{I();Pt();K9=yt("Cos",r=>Math.cos(r)),WM={kernelName:"Cos",backendName:"cpu",kernelFunc:K9}});var q9,HM,KM=h(()=>{I();Pt();q9=yt(Ts,r=>Math.cosh(r)),HM={kernelName:Ts,backendName:"cpu",kernelFunc:q9}});function X9(r){let{inputs:t,backend:e,attrs:o}=r,{image:n,boxes:s,boxInd:a}=t,{cropSize:i,method:c,extrapolationValue:l}=o,[u,p,m,f]=n.shape,d=s.shape[0],[x,g]=i,y=ut([d,x,g,f],"float32"),v=e.data.get(s.dataId).values,N=e.data.get(a.dataId).values,S=e.data.get(n.dataId).values,R=b.computeStrides(n.shape),A=b.computeStrides(y.shape);for(let _=0;_<d;_++){let D=_*4,L=v[D],M=v[D+1],V=v[D+2],W=v[D+3],G=N[_];if(G>=u)continue;let K=x>1?(V-L)*(p-1)/(x-1):0,U=g>1?(W-M)*(m-1)/(g-1):0;for(let j=0;j<x;j++){let Z=x>1?L*(p-1)+j*K:.5*(L+V)*(p-1);if(Z<0||Z>p-1){for(let q=0;q<g;q++)for(let Q=0;Q<f;Q++){let rt=Q+q*A[2]+j*A[1]+_*A[0];y.values[rt]=l}continue}if(c==="bilinear"){let q=Math.floor(Z),Q=Math.ceil(Z),rt=Z-q;for(let et=0;et<g;et++){let st=g>1?M*(m-1)+et*U:.5*(M+W)*(m-1);if(st<0||st>m-1){for(let lt=0;lt<f;lt++){let xt=lt+et*A[2]+j*A[1]+_*A[0];y.values[xt]=l}continue}let ot=Math.floor(st),at=Math.ceil(st),nt=st-ot;for(let lt=0;lt<f;lt++){let xt=lt+ot*R[2]+q*R[1]+G*R[0],gt=S[xt];xt=lt+at*R[2]+q*R[1]+G*R[0];let ht=S[xt];xt=lt+ot*R[2]+Q*R[1]+G*R[0];let Ct=S[xt];xt=lt+at*R[2]+Q*R[1]+G*R[0];let It=S[xt],Mt=gt+(ht-gt)*nt,Ht=Ct+(It-Ct)*nt;xt=lt+et*A[2]+j*A[1]+_*A[0],y.values[xt]=Mt+(Ht-Mt)*rt}}}else for(let q=0;q<g;++q){let Q=g>1?M*(m-1)+q*U:.5*(M+W)*(m-1);if(Q<0||Q>m-1){for(let st=0;st<f;st++){let ot=st+q*A[2]+j*A[1]+_*A[0];y.values[ot]=l}continue}let rt=Math.round(Q),et=Math.round(Z);for(let st=0;st<f;st++){let ot=st+rt*R[2]+et*R[1]+G*R[0],at=st+q*A[2]+j*A[1]+_*A[0];y.values[at]=S[ot]}}}}return e.makeTensorInfo(y.shape,y.dtype,y.values)}var qM,XM=h(()=>{I();qM={kernelName:_i,backendName:"cpu",kernelFunc:X9}});function j9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:a,reverse:i}=o;Y(n,"cumprod");let c=k.getAxesPermutation([s],n.shape.length),l=n;c!=null&&(l=ce({inputs:{x:n},backend:e,attrs:{perm:c}}));let u=k.getInnerMostAxes(1,n.shape.length)[0];if(u!==l.shape.length-1)throw new Error(`backend.cumprod in CPU expects an inner-most axis=${l.shape.length-1} but got axis=${u}`);let p=be(l.dtype,"int32"),m=b.makeOnesTypedArray(b.sizeFromShape(l.shape),p),f=e.data.get(l.dataId).values,d=l.shape[l.shape.length-1],x=i?(y,v)=>y+d-v-1:(y,v)=>y+v;for(let y=0;y<f.length;y+=d)for(let v=0;v<d;v++){let N=x(y,v);if(v===0)m[N]=a?1:f[N];else{let S=x(y,v-1);m[N]=a?f[S]*m[S]:f[N]*m[S]}}let g=e.makeTensorInfo(l.shape,p,m);if(c!=null){let y=k.getUndoAxesPermutation(c),v=ce({inputs:{x:g},backend:e,attrs:{perm:y}});return e.disposeIntermediateTensorInfo(g),e.disposeIntermediateTensorInfo(l),v}return g}var jM,YM=h(()=>{I();ft();Or();jM={kernelName:Ri,backendName:"cpu",kernelFunc:j9}});function Y9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:a,reverse:i}=o;Y(n,"cumsum");let c=k.getAxesPermutation([s],n.shape.length),l=n;c!=null&&(l=ce({inputs:{x:n},backend:e,attrs:{perm:c}}));let u=k.getInnerMostAxes(1,n.shape.length)[0];if(u!==l.shape.length-1)throw new Error(`backend.cumsum in CPU expects an inner-most axis=${l.shape.length-1} but got axis=${u}`);let p=be(l.dtype,"int32"),m=b.makeZerosTypedArray(b.sizeFromShape(l.shape),p),f=e.data.get(l.dataId).values,d=l.shape[l.shape.length-1],x=i?(y,v)=>y+d-v-1:(y,v)=>y+v;for(let y=0;y<f.length;y+=d)for(let v=0;v<d;v++){let N=x(y,v);if(v===0)m[N]=a?0:f[N];else{let S=x(y,v-1);m[N]=a?f[S]+m[S]:f[N]+m[S]}}let g=e.makeTensorInfo(l.shape,p,m);if(c!=null){let y=k.getUndoAxesPermutation(c),v=ce({inputs:{x:g},backend:e,attrs:{perm:y}});return e.disposeIntermediateTensorInfo(g),e.disposeIntermediateTensorInfo(l),v}return g}var ZM,QM=h(()=>{I();ft();Or();ZM={kernelName:Ai,backendName:"cpu",kernelFunc:Y9}});function Z9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:a,binaryOutput:i}=o;if(n.shape.length===1){let c=e.data.get(n.dataId).values,l=e.data.get(s.dataId).values,u=$l(c,l,s.dtype,s.shape,a);return e.makeTensorInfo([a],s.dtype,u)}else if(n.shape.length===2){let c=e.bufferSync(n),l=e.bufferSync(s),u=ld(c,l,a,i);return e.makeTensorInfo(u.shape,s.dtype,u.values)}throw new Error(`Error in denseBincount: input must be at most rank 2, but got rank${n.shape.length}.`)}var JM,tB=h(()=>{I();ud();JM={kernelName:Di,backendName:"cpu",kernelFunc:Z9}});function Q9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockSize:s,dataFormat:a}=o;b.assert(a==="NHWC",()=>`Only NHWC dataFormat supported on CPU for depthToSpace. Got ${a}`);let i=n.shape[0],c=n.shape[1],l=n.shape[2],u=n.shape[3],p=c*s,m=l*s,f=u/(s*s),d=e.data.get(n.dataId).values,x=new Float32Array(i*p*m*f),g=0;for(let y=0;y<i;++y)for(let v=0;v<p;++v){let N=Math.floor(v/s),S=v%s;for(let R=0;R<m;++R){let A=Math.floor(R/s),_=R%s,D=(S*s+_)*f;for(let L=0;L<f;++L){let V=L+D+u*(A+l*(N+c*y));x[g++]=d[V]}}}return e.makeTensorInfo([i,p,m,f],n.dtype,x)}var eB,rB=h(()=>{I();eB={kernelName:Fi,backendName:"cpu",kernelFunc:Q9}});function Gv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:a,pad:i,dilations:c,dimRoundingMode:l}=o;Y([n,s],"depthwiseConv2DNative");let u=b.computeStrides(n.shape),p=b.computeStrides(s.shape),m=c;m==null&&(m=[1,1]),b.assert(k.eitherStridesOrDilationsAreOne(a,m),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${a} and dilations '${m}'`);let f=k.computeConv2DInfo(n.shape,s.shape,a,m,i,l,!0),{filterHeight:d,filterWidth:x,dilationHeight:g,dilationWidth:y,padInfo:v}=f,N=v.left,S=v.top,R=f.outChannels/f.inChannels,A=new Bt(f.outShape,n.dtype),_=e.data.get(n.dataId).values,D=e.data.get(s.dataId).values,L=A.values;for(let M=0;M<f.batchSize;++M){let V=M*u[0],W=M*A.strides[0];for(let G=0;G<f.outHeight;++G){let K=W+G*A.strides[1],U=G*f.strideHeight-S;for(let j=0;j<d;++j){let Z=U+j*g;if(Z<0||Z>=f.inHeight)continue;let q=j*p[0],Q=V+Z*u[1];for(let rt=0;rt<f.outWidth;++rt){let et=K+rt*A.strides[2],st=rt*f.strideWidth-N;for(let ot=0;ot<x;++ot){let at=st+ot*y;if(at<0||at>=f.inWidth)continue;let nt=q+ot*p[1],lt=Q+at*f.inChannels,xt=et,gt=nt;for(let ht=0;ht<f.inChannels;++ht){let Ct=_[lt+ht];for(let It=0;It<R;++It)L[xt+It]+=Ct*D[gt+It];xt+=R,gt+=R}}}}}}return e.makeTensorInfo(A.shape,A.dtype,A.values)}var oB,Wv=h(()=>{I();ft();oB={kernelName:Oi,backendName:"cpu",kernelFunc:Gv}});function J9(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:a,dilations:i,pad:c,dimRoundingMode:l,filterShape:u}=o;Y([n,s],"depthwiseConv2dNativeBackpropFilter");let p=k.computeConv2DInfo(n.shape,u,a,i,c,l,!0),{strideHeight:m,strideWidth:f,filterHeight:d,filterWidth:x}=p,g=new Bt(p.filterShape,"float32"),y=p.padInfo.left,v=p.padInfo.top,N=p.outChannels/p.inChannels,S=e.data.get(n.dataId).values,R=new Bt(n.shape,n.dtype,S),A=e.data.get(s.dataId).values,_=new Bt(s.shape,s.dtype,A);for(let D=0;D<d;++D){let L=Math.max(0,Math.ceil((v-D)/m)),M=Math.min(p.outHeight,(p.inHeight+v-D)/m);for(let V=0;V<x;++V){let W=Math.max(0,Math.ceil((y-V)/f)),G=Math.min(p.outWidth,(p.inWidth+y-V)/f);for(let K=0;K<p.outChannels;++K){let U=Math.trunc(K/N),j=K%N,Z=0;for(let q=0;q<p.batchSize;++q)for(let Q=L;Q<M;++Q){let rt=D+Q*m-v;for(let et=W;et<G;++et){let st=V+et*f-y;Z+=R.get(q,rt,st,U)*_.get(q,Q,et,K)}}g.set(Z,D,V,U,j)}}}return e.makeTensorInfo(g.shape,g.dtype,g.values)}var nB,sB=h(()=>{I();ft();nB={kernelName:Pi,backendName:"cpu",kernelFunc:J9}});function tJ(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{strides:a,dilations:i,pad:c,dimRoundingMode:l,inputShape:u}=o;Y([n,s],"depthwiseConv2DNativeBackpropInput");let p=b.computeStrides(n.shape),m=b.computeStrides(s.shape),f=k.computeConv2DInfo(u,s.shape,a,i,c,l,!0),d=new Bt(f.inShape,"float32"),x=d.values,[g,y,v]=d.strides,N=e.data.get(n.dataId).values,[S,R,A]=p,_=e.data.get(s.dataId).values,[D,L,M]=m,{batchSize:V,filterHeight:W,filterWidth:G,inChannels:K,inHeight:U,inWidth:j,outChannels:Z,outHeight:q,outWidth:Q,strideHeight:rt,strideWidth:et}=f,st=W-1-f.padInfo.top,ot=G-1-f.padInfo.left,at=Z/K;for(let nt=0;nt<V;++nt)for(let lt=0;lt<K;++lt)for(let xt=0;xt<U;++xt){let gt=xt-st,ht=Math.max(0,Math.ceil(gt/rt)),Ct=Math.min(q,(W+gt)/rt);for(let It=0;It<j;++It){let Mt=It-ot,Ht=Math.max(0,Math.ceil(Mt/et)),Zt=Math.min(Q,(G+Mt)/et),Kt=0;for(let Ut=ht;Ut<Ct;++Ut){let Qt=Ut*rt-gt;for(let jt=Ht;jt<Zt;++jt){let te=jt*et-Mt,Ne=S*nt+R*Ut+A*jt,Te=D*(W-1-Qt)+L*(G-1-te)+M*lt;for(let le=0;le<at;++le){let $o=lt*at+le,Tr=N[Ne+$o],He=_[Te+le];Kt+=Tr*He}}}x[g*nt+y*xt+v*It+lt]=Kt}}return e.makeTensorInfo(d.shape,d.dtype,d.values)}var aB,iB=h(()=>{I();ft();aB={kernelName:Li,backendName:"cpu",kernelFunc:tJ}});function eJ(r){let{inputs:t,backend:e}=r,{x:o}=t,n=b.sizeFromShape(o.shape),s=e.data.get(o.dataId).values,a=ut([n,n],o.dtype),i=a.values;for(let l=0;l<s.length;l++)i[l*n+l]=s[l];let c=[...o.shape,...o.shape];return e.makeTensorInfo(c,a.dtype,a.values)}var cB,lB=h(()=>{I();cB={kernelName:Mi,backendName:"cpu",kernelFunc:eJ}});var uB,pB=h(()=>{I();uB={kernelName:Bi,backendName:"cpu",kernelFunc:({inputs:r,backend:t,attrs:e})=>{let{x:o,filter:n}=r,{strides:s,pad:a,dilations:i}=e,c=t,l=c.data.get(o.dataId).values,u=o.shape.length,p=c.data.get(n.dataId).values,m=n.shape.length,{batchSize:f,inHeight:d,inWidth:x,inChannels:g,outHeight:y,outWidth:v,padInfo:N,strideHeight:S,strideWidth:R,filterHeight:A,filterWidth:_,dilationHeight:D,dilationWidth:L,outShape:M}=k.computeDilation2DInfo(o.shape,n.shape,s,a,"NHWC",i),V=b.sizeFromShape(M),W=M.length,G=b.getArrayFromDType(o.dtype,V);for(let U=0;U<f;++U)for(let j=0;j<y;++j){let Z=j*S-N.top;for(let q=0;q<v;++q){let Q=q*R-N.left;for(let rt=0;rt<g;++rt){let et=Number.MIN_SAFE_INTEGER;for(let ot=0;ot<A;++ot){let at=Z+ot*D;if(at>=0&&at<d)for(let nt=0;nt<_;++nt){let lt=Q+nt*L;if(lt>=0&&lt<x){let xt=b.locToIndex([U,at,lt,rt],u,b.computeStrides(o.shape)),gt=b.locToIndex([ot,nt,rt],m,b.computeStrides(n.shape)),ht=l[xt]+p[gt];ht>et&&(et=ht)}}}let st=b.locToIndex([U,j,q,rt],W,b.computeStrides(M));G[st]=et}}}return{dataId:c.write(b.toTypedArray(G,o.dtype),M,o.dtype),shape:M,dtype:o.dtype}}}});var mB,fB=h(()=>{I();mB={kernelName:ex,backendName:"cpu",kernelFunc:({inputs:r,backend:t,attrs:e})=>{let{x:o,filter:n,dy:s}=r,{strides:a,pad:i,dilations:c}=e,l=t,u=b.toNestedArray(o.shape,l.data.get(o.dataId).values),p=b.toNestedArray(n.shape,l.data.get(n.dataId).values),{batchSize:m,inHeight:f,inWidth:d,inChannels:x,outHeight:g,outWidth:y,padInfo:v,strideHeight:N,strideWidth:S,filterHeight:R,filterWidth:A,dilationHeight:_,dilationWidth:D,outShape:L}=k.computeDilation2DInfo(o.shape,n.shape,a,i,"NHWC",c);b.assert(s.rank===L.length,()=>`Error in ${ex}, dy must have the same rank as output ${L.length}, but got ${s.rank}`);let M=b.toNestedArray(L,l.data.get(s.dataId).values),V=b.makeZerosNestedTypedArray(n.shape,n.dtype);for(let G=0;G<m;++G)for(let K=0;K<g;++K){let U=K*N-v.top;for(let j=0;j<y;++j){let Z=j*S-v.left;for(let q=0;q<x;++q){let Q=Number.MIN_SAFE_INTEGER,rt=0,et=0;for(let st=0;st<R;++st){let ot=U+st*_;if(ot>=0&&ot<f)for(let at=0;at<A;++at){let nt=Z+at*D;if(nt>=0&&nt<d){let lt=u[G][ot][nt][q]+p[st][at][q];lt>Q&&(Q=lt,rt=st,et=at)}}}V[rt][et][q]+=M[G][K][j][q]}}}return{dataId:l.write(b.toTypedArray(V,o.dtype),n.shape,n.dtype),shape:n.shape,dtype:n.dtype}}}});var dB,hB=h(()=>{I();dB={kernelName:tx,backendName:"cpu",kernelFunc:({inputs:r,backend:t,attrs:e})=>{let{x:o,filter:n,dy:s}=r,{strides:a,pad:i,dilations:c}=e,l=t,u=b.toNestedArray(o.shape,l.data.get(o.dataId).values),p=b.toNestedArray(n.shape,l.data.get(n.dataId).values),{batchSize:m,inHeight:f,inWidth:d,inChannels:x,outHeight:g,outWidth:y,padInfo:v,strideHeight:N,strideWidth:S,filterHeight:R,filterWidth:A,dilationHeight:_,dilationWidth:D,outShape:L}=k.computeDilation2DInfo(o.shape,n.shape,a,i,"NHWC",c);b.assert(s.rank===L.length,()=>`Error in ${tx}, dy must have the same rank as output ${L.length}, but got ${s.rank}`);let M=b.toNestedArray(L,l.data.get(s.dataId).values),V=b.makeZerosNestedTypedArray(o.shape,o.dtype);for(let G=0;G<m;++G)for(let K=0;K<g;++K){let U=K*N-v.top;for(let j=0;j<y;++j){let Z=j*S-v.left;for(let q=0;q<x;++q){let Q=Number.MIN_SAFE_INTEGER,rt=U<0?0:U,et=Z<0?0:Z;for(let st=0;st<R;++st){let ot=U+st*_;if(ot>=0&&ot<f)for(let at=0;at<A;++at){let nt=Z+at*D;if(nt>=0&&nt<d){let lt=u[G][ot][nt][q]+p[st][at][q];lt>Q&&(Q=lt,rt=ot,et=nt)}}}V[G][rt][et][q]+=M[G][K][j][q]}}}return{dataId:l.write(b.toTypedArray(V,o.dtype),o.shape,o.dtype),shape:o.shape,dtype:o.dtype}}}});function rJ(r){let{inputs:t,backend:e,attrs:o}=r,{image:n}=t,{canvas:s,options:a}=o,{contextOptions:i,imageOptions:c}=a||{},l=(c==null?void 0:c.alpha)||1,u=(i==null?void 0:i.contextType)||"2d";if(u!=="2d")throw new Error(`Context type ${i.contextType} is not supported by the CPU backend.`);let p=s.getContext(u,(i==null?void 0:i.contextAttributes)||{});if(p==null)throw new Error(`Could not get the context with ${u} type.`);let[m,f]=n.shape.slice(0,2),d=n.shape.length===2?1:n.shape[2],x=e.data.get(n.dataId).values,g=n.dtype==="float32"?255:1,y=new Uint8ClampedArray(f*m*4);for(let N=0;N<m*f;++N){let S=[0,0,0,255*l];for(let A=0;A<d;A++){let _=x[N*d+A];if(n.dtype==="float32"){if(_<0||_>1)throw new Error(`Tensor values for a float32 Tensor must be in the range [0 - 1] but encountered ${_}.`)}else if(n.dtype==="int32"&&(_<0||_>255))throw new Error(`Tensor values for a int32 Tensor must be in the range [0 - 255] but encountered ${_}.`);d===1?(S[0]=_*g,S[1]=_*g,S[2]=_*g):S[A]=_*g}let R=N*4;y[R+0]=Math.round(S[0]),y[R+1]=Math.round(S[1]),y[R+2]=Math.round(S[2]),y[R+3]=Math.round(S[3])}s.width=f,s.height=m;let v=new ImageData(y,f,m);return p.putImageData(v,0,0),n}var gB,xB=h(()=>{I();gB={kernelName:ru,backendName:"cpu",kernelFunc:rJ}});function Sn(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;Y(n,"sum");let i;n.dtype==="bool"?i=lo({inputs:{x:n},backend:e,attrs:{dtype:"int32"}}):i=Qe({inputs:{x:n},backend:e});let c=i.shape.length,l=b.parseAxisParam(s,i.shape),u=k.getAxesPermutation(l,c),p=l,m=i;u!=null&&(m=ce({inputs:{x:i},backend:e,attrs:{perm:u}}),p=k.getInnerMostAxes(p.length,c)),k.assertAxesAreInnerMostDims("sum",p,m.shape.length);let[f,d]=k.computeOutAndReduceShapes(m.shape,p),x=k.upcastType(m.dtype,"int32"),g=kl(e,f,x),y=b.sizeFromShape(d),v=e.data.get(g.dataId).values,N=e.data.get(m.dataId).values;for(let S=0;S<v.length;++S){let R=S*y,A=0;for(let _=0;_<y;++_)A+=N[R+_];v[S]=A}if(a){let S=k.expandShapeToKeepDim(g.shape,l),R=g;g=At({inputs:{x:g},backend:e,attrs:{shape:S}}),e.disposeIntermediateTensorInfo(R)}return e.disposeIntermediateTensorInfo(i),u!=null&&e.disposeIntermediateTensorInfo(m),g}var yB,Kl=h(()=>{I();ft();xb();qa();qo();Ue();Or();yB={kernelName:"Sum",backendName:"cpu",kernelFunc:Sn}});function oJ(r){let{inputs:t,backend:e,attrs:o}=r,{equation:n}=o,s=t,{allDims:a,summedDims:i,idDims:c}=k.decodeEinsumEquation(n,s.length);k.checkEinsumDimSizes(a.length,c,s);let{path:l,steps:u}=k.getEinsumComputePath(i,c),p=u.length,m=null,f=a.length,d=[];for(let x=0;x<p;++x){for(let g of u[x]){let{permutationIndices:y,expandDims:v}=k.getEinsumPermutation(f,c[g]),N;k.isIdentityPermutation(y)?N=s[g]:(N=ce({inputs:{x:s[g]},backend:e,attrs:{perm:y}}),d.push(N));let S=N.shape.slice();for(let R=0;R<v.length;++R)S.splice(v[R],0,1);b.arraysEqual(N.shape,S)||(N=At({inputs:{x:N},backend:e,attrs:{shape:S}}),d.push(N)),m===null?m=N:(m=ja({inputs:{a:N,b:m},backend:e}),d.push(m))}x<p-1&&(l[x]>=0&&(m=Sn({inputs:{x:m},backend:e,attrs:{axis:l[x]-(a.length-f),keepDims:!1}}),d.push(m)),f--)}for(let x of d)x!==m&&e.disposeIntermediateTensorInfo(x);return m}var bB,vB=h(()=>{I();Ya();Ue();Kl();Or();bB={kernelName:Vi,backendName:"cpu",kernelFunc:oJ}});function nJ(r){let{inputs:t,backend:e}=r,{dy:o,y:n}=t;Y([o,n],"eluGrad");let s=new Float32Array(b.sizeFromShape(n.shape)),a=e.data.get(n.dataId).values,i=e.data.get(o.dataId).values;for(let c=0;c<a.length;++c){let l=a[c];l>=0?s[c]=i[c]:s[c]=i[c]*(l+1)}return e.makeTensorInfo(n.shape,"float32",s)}var wB,CB=h(()=>{I();ft();wB={kernelName:Kp,backendName:"cpu",kernelFunc:nJ}});var sJ,aJ,iJ,cJ,lJ,uJ,pJ,SB,NB=h(()=>{I();Pt();sJ=k.ERF_P,aJ=k.ERF_A1,iJ=k.ERF_A2,cJ=k.ERF_A3,lJ=k.ERF_A4,uJ=k.ERF_A5,pJ=yt("Erf",r=>{let t=Math.sign(r),e=Math.abs(r),o=1/(1+sJ*e);return t*(1-((((uJ*o+lJ)*o+cJ)*o+iJ)*o+aJ)*o*Math.exp(-e*e))}),SB={kernelName:"Erf",backendName:"cpu",kernelFunc:pJ}});function ql(r){let{inputs:t,backend:e,attrs:o}=r,{input:n}=t,{dim:s}=o,a=n.shape.length,i=n.shape.slice(),c=s;return s<0&&(b.assert(-(a+1)<=s,()=>`Axis must be in the interval [${-(a+1)}, ${a}]`),c=a+s+1),i.splice(c,0,1),At({inputs:{x:n},backend:e,attrs:{shape:i}})}var TB,xg=h(()=>{I();Ue();TB={kernelName:zi,backendName:"cpu",kernelFunc:ql}});var mJ,Cp,Sp,Np=h(()=>{I();we();$e();mJ=Rt((r,t)=>r/t),Cp=Ot(Is,mJ),Sp={kernelName:Is,backendName:"cpu",kernelFunc:Cp}});function yg(r,t,e){let o=r.shape,n=o[0],s=o[1],a=e.data.get(r.dataId),i=a.complexTensorInfos.real,c=a.complexTensorInfos.imag,l=[n,s],u=b.sizeFromShape(l),p=b.getTypedArrayFromDType("float32",u),m=b.getTypedArrayFromDType("float32",u);for(let g=0;g<n;g++){let y=po({inputs:{x:i},backend:e,attrs:{begin:[g,0],size:[1,s]}}),v=po({inputs:{x:c},backend:e,attrs:{begin:[g,0],size:[1,s]}}),N=Ee({inputs:{real:y,imag:v},backend:e}),{real:S,imag:R}=fJ(N,t,e),A=k.mergeRealAndImagArrays(S,R);for(let _=0;_<s;_++){let D=k.getComplexWithIndex(A,_);p[g*s+_]=D.real,m[g*s+_]=D.imag}e.disposeIntermediateTensorInfo(y),e.disposeIntermediateTensorInfo(v),e.disposeIntermediateTensorInfo(N)}let f=e.makeTensorInfo(l,"float32",p),d=e.makeTensorInfo(l,"float32",m),x=Ee({inputs:{real:f,imag:d},backend:e});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),x}function fJ(r,t,e){let o=b.sizeFromShape(r.shape),n=e.data.get(r.dataId),s=e.data.get(n.complexTensorInfos.real.dataId).values,a=e.data.get(n.complexTensorInfos.imag.dataId).values;if(dJ(o)){let i=Uv(s,a,o,t,e),c=[r.shape[0],r.shape[1]];if(t){let l=e.makeTensorInfo(c,"float32",i.real),u=e.makeTensorInfo(c,"float32",i.imag),p=e.makeTensorInfo([],"float32",b.createScalarValue(o,"float32")),m=Qe({inputs:{x:p},backend:e}),f=Sp.kernelFunc({inputs:{a:l,b:p},backend:e}),d=Sp.kernelFunc({inputs:{a:u,b:m},backend:e}),x=e.data.get(f.dataId).values,g=e.data.get(d.dataId).values;return e.disposeIntermediateTensorInfo(l),e.disposeIntermediateTensorInfo(u),e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),{real:x,imag:g}}return i}else{let i=k.mergeRealAndImagArrays(s,a),c=hJ(i,o,t);return k.splitRealAndImagArrays(c)}}function dJ(r){return(r&r-1)===0}function Uv(r,t,e,o,n){if(e===1)return{real:r,imag:t};let s=k.mergeRealAndImagArrays(r,t),a=e/2,i=k.complexWithEvenIndex(s),c=i.real,l=i.imag,u=[c.length],p=n.makeTensorInfo(u,"float32",c),m=n.makeTensorInfo(u,"float32",l),f=Ee({inputs:{real:p,imag:m},backend:n}),d=k.complexWithOddIndex(s),x=d.real,g=d.imag,y=[x.length],v=n.makeTensorInfo(y,"float32",x),N=n.makeTensorInfo(y,"float32",g),S=Ee({inputs:{real:v,imag:N},backend:n}),R=Uv(c,l,a,o,n),A=R.real,_=R.imag,D=[A.length],L=n.makeTensorInfo(D,"float32",A),M=n.makeTensorInfo(D,"float32",_),V=Ee({inputs:{real:L,imag:M},backend:n}),W=Uv(x,g,a,o,n),G=W.real,K=W.imag,U=[G.length],j=n.makeTensorInfo(U,"float32",G),Z=n.makeTensorInfo(U,"float32",K),q=Ee({inputs:{real:j,imag:Z},backend:n}),Q=k.exponents(e,o),rt=[Q.real.length],et=n.makeTensorInfo(rt,"float32",Q.real),st=n.makeTensorInfo(rt,"float32",Q.imag),ot=Ee({inputs:{real:et,imag:st},backend:n}),at=ja({inputs:{a:ot,b:q},backend:n}),nt=Xo({inputs:{a:V,b:at},backend:n}),lt=cp({inputs:{a:V,b:at},backend:n}),xt=co({inputs:{input:nt},backend:n}),gt=co({inputs:{input:lt},backend:n}),ht=Zo({inputs:{input:nt},backend:n}),Ct=Zo({inputs:{input:lt},backend:n}),It=is({inputs:[xt,gt],backend:n,attrs:{axis:0}}),Mt=is({inputs:[ht,Ct],backend:n,attrs:{axis:0}}),Ht=n.data.get(It.dataId).values,Zt=n.data.get(Mt.dataId).values;return n.disposeIntermediateTensorInfo(p),n.disposeIntermediateTensorInfo(m),n.disposeIntermediateTensorInfo(f),n.disposeIntermediateTensorInfo(v),n.disposeIntermediateTensorInfo(N),n.disposeIntermediateTensorInfo(S),n.disposeIntermediateTensorInfo(L),n.disposeIntermediateTensorInfo(M),n.disposeIntermediateTensorInfo(V),n.disposeIntermediateTensorInfo(j),n.disposeIntermediateTensorInfo(Z),n.disposeIntermediateTensorInfo(q),n.disposeIntermediateTensorInfo(et),n.disposeIntermediateTensorInfo(st),n.disposeIntermediateTensorInfo(ot),n.disposeIntermediateTensorInfo(at),n.disposeIntermediateTensorInfo(nt),n.disposeIntermediateTensorInfo(lt),n.disposeIntermediateTensorInfo(xt),n.disposeIntermediateTensorInfo(ht),n.disposeIntermediateTensorInfo(gt),n.disposeIntermediateTensorInfo(Ct),n.disposeIntermediateTensorInfo(It),n.disposeIntermediateTensorInfo(Mt),{real:Ht,imag:Zt}}function hJ(r,t,e){let o=new Float32Array(t*2);for(let n=0;n<t;n++){let s=0,a=0;for(let i=0;i<t;i++){let c=k.exponent(n*i,t,e),l=k.getComplexWithIndex(r,i);s+=l.real*c.real-l.imag*c.imag,a+=l.real*c.imag+l.imag*c.real}e&&(s/=t,a/=t),k.assignToTypedArray(o,s,a,n)}return o}var Hv=h(()=>{I();Xa();yn();gg();qo();Hl();Ya();Ka();Np();ts();lp();});function gJ(r){let{inputs:t,backend:e}=r,{input:o}=t,n=b.sizeFromShape(o.shape),s=o.shape[o.shape.length-1],a=n/s,i=At({inputs:{x:o},backend:e,attrs:{shape:[a,s]}}),c=yg(i,!1,e),l=At({inputs:{x:c},backend:e,attrs:{shape:o.shape}});return e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(c),l}var IB,kB=h(()=>{I();Hv();Ue();IB={kernelName:"FFT",backendName:"cpu",kernelFunc:gJ}});function Tp(r){let{backend:t,attrs:e}=r,{shape:o,value:n,dtype:s}=e,a=s||b.inferDtype(n),i=b.getArrayFromDType(a,b.sizeFromShape(o));return xJ(i,n,a),t.makeTensorInfo(o,a,i)}function xJ(r,t,e){r.fill(t)}var EB,bg=h(()=>{I();EB={kernelName:Gi,backendName:"cpu",kernelFunc:Tp}});var $B,RB=h(()=>{I();$B={kernelName:Wi,backendName:"cpu",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{image:o}=r,n=e,s=b.getTypedArrayFromDType(o.dtype,b.sizeFromShape(o.shape)),[a,i,c,l]=o.shape,u=n.data.get(o.dataId).values;for(let m=0;m<a;m++){let f=m*c*i*l;for(let d=0;d<i;d++){let x=d*(c*l);for(let g=0;g<c;g++){let y=g*l;for(let v=0;v<l;v++){let N=Math.round(c-g-1),S=f+x+y+v,R=u[S];if(N>=0&&N<c){let A=N*l,_=f+x+A+v;R=u[_]}s[S]=R}}}}return{dataId:n.write(s,o.shape,o.dtype),shape:o.shape,dtype:o.dtype}}}});function yJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:a,preluActivationWeights:i}=t,{strides:c,pad:l,dataFormat:u,dilations:p,dimRoundingMode:m,activation:f,leakyreluAlpha:d}=o,x=Vv({inputs:{x:n,filter:s},backend:e,attrs:{strides:c,pad:l,dataFormat:u,dilations:p,dimRoundingMode:m}});if(a){let g=x;if(u==="NCHW"&&a.shape.length===1&&a.shape[0]!==1){let y=At({inputs:{x:a},backend:e,attrs:{shape:[a.shape[0],1,1]}});x=Xo({inputs:{a:x,b:y},backend:e}),e.disposeIntermediateTensorInfo(y)}else x=Xo({inputs:{a:x,b:a},backend:e});e.disposeIntermediateTensorInfo(g)}if(f){let g=x;if(u==="NCHW"&&f==="prelu"&&i.shape.length===1&&i.shape[0]!==1){let y=At({inputs:{x:i},backend:e,attrs:{shape:[i.shape[0],1,1]}});x=si(e,x,f,y,d),e.disposeIntermediateTensorInfo(y)}else x=si(e,x,f,i,d);e.disposeIntermediateTensorInfo(g)}return x}var AB,_B=h(()=>{I();fg();Xa();zv();Ue();AB={kernelName:ca,backendName:"cpu",kernelFunc:yJ}});function bJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:a,preluActivationWeights:i}=t,{strides:c,pad:l,dataFormat:u,dilations:p,dimRoundingMode:m,activation:f,leakyreluAlpha:d}=o,x=Gv({inputs:{x:n,filter:s},backend:e,attrs:{strides:c,pad:l,dataFormat:u,dilations:p,dimRoundingMode:m}});if(a){let g=x;x=Xo({inputs:{a:x,b:a},backend:e}),e.disposeIntermediateTensorInfo(g)}if(f){let g=x;x=si(e,x,f,i,d),e.disposeIntermediateTensorInfo(g)}return x}var DB,FB=h(()=>{I();fg();Xa();Wv();DB={kernelName:la,backendName:"cpu",kernelFunc:bJ}});function vJ(r){let{inputs:t,backend:e}=r,{params:o,indices:n}=t,s=b.sizeFromShape(o.shape),a=n.shape,i=a[a.length-1],[c,l,u,p]=k.prepareAndValidate(o,n);if(l===0)return e.makeTensorInfo(c,o.dtype,[]);let m=e.data.get(n.dataId).values,f=e.bufferSync(o),d=dd(m,f,o.dtype,l,i,u,p,o.shape,s);return e.makeTensorInfo(c,o.dtype,d.values)}var OB,PB=h(()=>{I();Ob();OB={kernelName:Ki,backendName:"cpu",kernelFunc:vJ}});function wJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,indices:s}=t,{axis:a,batchDims:i}=o;Y([n,s],"gatherV2");let c=b.parseAxisParam(a,n.shape)[0],l=e.data.get(s.dataId).values,u=n.shape[c];for(let S=0;S<l.length;++S){let R=l[S];b.assert(R<=u-1&&R>=0,()=>`GatherV2: the index value ${R} is not in [0, ${u-1}]`)}let p=i;i==null&&(p=0);let m=b.sizeFromShape(s.shape),f=k.segment_util.collectGatherOpShapeInfo(n,s,c,p),d=At({inputs:{x:n},backend:e,attrs:{shape:[f.batchSize,f.outerSize,f.dimSize,f.sliceSize]}}),x=At({inputs:{x:s},backend:e,attrs:{shape:[f.batchSize,m/f.batchSize]}}),g=[f.batchSize,f.outerSize,m/f.batchSize,f.sliceSize],y=e.bufferSync(x),v=e.bufferSync(d),N=hd(v,y,g);return e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(x),e.makeTensorInfo(f.outputShape,N.dtype,N.values)}var LB,MB=h(()=>{I();ft();Pb();Ue();LB={kernelName:Hi,backendName:"cpu",kernelFunc:wJ}});function CJ(r){let{inputs:t,backend:e}=r,{input:o}=t,n=b.sizeFromShape(o.shape),s=o.shape[o.shape.length-1],a=n/s,i=At({inputs:{x:o},backend:e,attrs:{shape:[a,s]}}),c=yg(i,!0,e),l=At({inputs:{x:c},backend:e,attrs:{shape:o.shape}});return e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(c),l}var BB,VB=h(()=>{I();Hv();Ue();BB={kernelName:qi,backendName:"cpu",kernelFunc:CJ}});var SJ,zB,GB=h(()=>{I();Pt();SJ=yt(Ds,r=>Number.isFinite(r)?1:0,"bool"),zB={kernelName:Ds,backendName:"cpu",kernelFunc:SJ}});var NJ,WB,UB=h(()=>{I();Pt();NJ=yt(Fs,r=>Math.abs(r)===1/0?1:0,"bool"),WB={kernelName:Fs,backendName:"cpu",kernelFunc:NJ}});var TJ,HB,KB=h(()=>{I();Pt();TJ=yt(Os,r=>Number.isNaN(r)?1:0,"bool"),HB={kernelName:Os,backendName:"cpu",kernelFunc:TJ}});function IJ(r){let{backend:t,attrs:e}=r,{start:o,stop:n,num:s}=e,a=gd(o,n,s);return t.makeTensorInfo([a.length],"float32",a)}var qB,XB=h(()=>{I();Hb();qB={kernelName:Yi,backendName:"cpu",kernelFunc:IJ}});var kJ,jB,YB=h(()=>{I();Pt();kJ=yt(Ms,r=>Math.log1p(r)),jB={kernelName:Ms,backendName:"cpu",kernelFunc:kJ}});var EJ,$J,ZB,QB=h(()=>{I();we();$e();EJ=Rt((r,t)=>r&&t),$J=Ot(Bs,EJ,null,"bool"),ZB={kernelName:Bs,backendName:"cpu",kernelFunc:$J}});var RJ,JB,tV=h(()=>{I();Pt();RJ=yt(Vs,r=>r?0:1,"bool"),JB={kernelName:Vs,backendName:"cpu",kernelFunc:RJ}});var AJ,_J,eV,rV=h(()=>{I();we();$e();AJ=Rt((r,t)=>r||t),_J=Ot(zs,AJ,null,"bool"),eV={kernelName:zs,backendName:"cpu",kernelFunc:_J}});function DJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{depthRadius:s,bias:a,alpha:i,beta:c}=o;Y(n,"LRN");let l=n.shape[3],u=l-1,p=e.data.get(n.dataId).values,m=b.sizeFromShape(n.shape),f=new Float32Array(m);function d(x){let g=x%l,y=x-g+Math.max(0,g-s),v=x-g+Math.min(g+s,u),N=0;for(;y<=v;y++){let S=p[y];N+=S*S}return N}for(let x=0;x<m;x++){let g=d(x),y=p[x]*Math.pow(a+i*g,-c);f[x]=y}return e.makeTensorInfo(n.shape,n.dtype,f)}var oV,nV=h(()=>{I();ft();oV={kernelName:"LRN",backendName:"cpu",kernelFunc:DJ}});function FJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,y:s,dy:a}=t,{depthRadius:i,bias:c,alpha:l,beta:u}=o;Y(a,"LRNGrad");let p=b.sizeFromShape(a.shape),m=a.shape[3],f=e.data.get(a.dataId).values,d=e.data.get(n.dataId).values,x=e.data.get(s.dataId).values,g=new Float32Array(p),y=p;for(let v=0;v<y;v++){let N=v%m,S=v-N+Math.max(0,N-i),R=v-N+Math.min(m,N+i+1),A=0;for(let _=S;_<R;_++)A+=Math.pow(d[_],2);A=l*A+c;for(let _=S;_<R;_++){let D=-2*l*u*d[_]*x[v]/A;v===_&&(D+=Math.pow(A,-u)),D*=f[v],g[_]+=D}}return e.makeTensorInfo(a.shape,n.dtype,g)}var sV,aV=h(()=>{I();ft();sV={kernelName:qp,backendName:"cpu",kernelFunc:FJ}});function Kv(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reductionIndices:s,keepDims:a}=o,i=e,c=n.shape,l=c.length,u=b.parseAxisParam(s,c),p=u,m=k.getAxesPermutation(p,l),f=i.data.get(n.dataId).values;if(m!=null){let S=new Array(l);for(let R=0;R<S.length;R++)S[R]=c[m[R]];f=Rl(f,c,n.dtype,m,S),p=k.getInnerMostAxes(p.length,l),c=S}Y(n,"max"),k.assertAxesAreInnerMostDims("max",p,l);let[d,x]=k.computeOutAndReduceShapes(c,p),g=b.sizeFromShape(x),y=xd(f,g,d,n.dtype),v=i.write(y,d,n.dtype),N=d;return a&&(N=k.expandShapeToKeepDim(d,u)),{dataId:v,shape:N,dtype:n.dtype}}var iV,qv=h(()=>{I();I();I();ft();Xb();yd();iV={kernelName:"Max",backendName:"cpu",kernelFunc:Kv}});function OJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;Y(n,"maxPool");let{filterSize:s,strides:a,pad:i,dimRoundingMode:c}=o,l=1;b.assert(k.eitherStridesOrDilationsAreOne(a,l),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${a} and dilations '${l}'`);let u=k.computePool2DInfo(n.shape,s,a,l,i,c),p;if(u.filterWidth===1&&u.filterHeight===1&&b.arraysEqual(u.inShape,u.outShape))p=Qe({inputs:{x:n},backend:e});else{let m=e.data.get(n.dataId).values,f=b.computeStrides(n.shape),d=Ul(m,n.shape,n.dtype,f,u,"max");p=e.makeTensorInfo(u.outShape,n.dtype,d.values)}return p}var cV,lV=h(()=>{I();ft();as();qo();cV={kernelName:Zi,backendName:"cpu",kernelFunc:OJ}});function PJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:a,pad:i,dimRoundingMode:c,dataFormat:l}=o;Y(n,"maxPool3d");let u=k.computePool3DInfo(n.shape,s,a,1,i,c,l),p=e.data.get(n.dataId).values,m=hg(p,n.shape,n.dtype,b.computeStrides(n.shape),u,"max");return e.makeTensorInfo(m.shape,"float32",m.values)}var uV,pV=h(()=>{I();ft();as();uV={kernelName:Qi,backendName:"cpu",kernelFunc:PJ}});function LJ(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,{filterSize:a,strides:i,pad:c,dimRoundingMode:l}=o;Y([n,s],"maxPool3DGrad");let u=k.computePool3DInfo(s.shape,a,i,1,c,l),p=e.bufferSync(s),m=lM(p,u),f=u.strideDepth,d=u.strideHeight,x=u.strideWidth,g=u.dilationDepth,y=u.dilationHeight,v=u.dilationWidth,N=u.effectiveFilterDepth,S=u.effectiveFilterHeight,R=u.effectiveFilterWidth,A=N-1-u.padInfo.front,_=R-1-u.padInfo.left,D=S-1-u.padInfo.top,L=ut(s.shape,"float32"),M=e.bufferSync(n);for(let V=0;V<u.batchSize;++V)for(let W=0;W<u.inChannels;++W)for(let G=0;G<u.inDepth;++G)for(let K=0;K<u.inHeight;++K)for(let U=0;U<u.inWidth;++U){let j=G-A,Z=K-D,q=U-_,Q=0;for(let rt=0;rt<N;rt+=g){let et=(j+rt)/f;if(!(et<0||et>=u.outDepth||Math.floor(et)!==et))for(let st=0;st<S;st+=y){let ot=(Z+st)/d;if(!(ot<0||ot>=u.outHeight||Math.floor(ot)!==ot))for(let at=0;at<R;at+=v){let nt=(q+at)/x;if(nt<0||nt>=u.outWidth||Math.floor(nt)!==nt)continue;let lt=N*S*R-1-m.get(V,et,ot,nt,W),xt=rt*S*R+st*R+at,gt=lt===xt?1:0;if(gt===0)continue;let ht=M.get(V,et,ot,nt,W);Q+=ht*gt}}}L.set(Q,V,G,K,U,W)}return e.makeTensorInfo(L.shape,L.dtype,L.values)}var mV,fV=h(()=>{I();ft();as();mV={kernelName:jp,backendName:"cpu",kernelFunc:LJ}});function MJ(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s,output:a}=t,i=s;Y([s,a],"maxPoolGrad");let{filterSize:c,strides:l,pad:u,dimRoundingMode:p}=o,m=k.computePool2DInfo(i.shape,c,l,1,u,p),f=e.data.get(i.dataId).values,d=ut(m.outShape,i.dtype,dg(f,i.shape,i.dtype,m).values),x=m.strideHeight,g=m.strideWidth,y=m.dilationHeight,v=m.dilationWidth,N=m.effectiveFilterHeight,S=m.effectiveFilterWidth,R=S-1-m.padInfo.left,A=N-1-m.padInfo.top,_=ut(i.shape,"float32"),D=e.data.get(n.dataId).values,L=ut(n.shape,"float32",D);for(let M=0;M<m.batchSize;++M)for(let V=0;V<m.inChannels;++V)for(let W=0;W<m.inHeight;++W)for(let G=0;G<m.inWidth;++G){let K=W-A,U=G-R,j=0;for(let Z=0;Z<N;Z+=y){let q=(K+Z)/x;if(!(q<0||q>=m.outHeight||Math.floor(q)!==q))for(let Q=0;Q<S;Q+=v){let rt=(U+Q)/g;if(rt<0||rt>=m.outWidth||Math.floor(rt)!==rt)continue;let et=N*S-1-d.get(M,q,rt,V),st=Z*S+Q,ot=et===st?1:0;if(ot===0)continue;let at=L.get(M,q,rt,V);j+=at*ot}}_.set(j,M,W,G,V)}return e.makeTensorInfo(_.shape,_.dtype,_.values)}var dV,hV=h(()=>{I();ft();as();dV={kernelName:Xp,backendName:"cpu",kernelFunc:MJ}});function gV(r,t,e,o,n){let s=b.computeStrides(t),a=Ul(r,t,e,s,n,"max"),i=dg(r,t,e,n,!0,o);return[a.values,i.values]}var xV=h(()=>{I();as();});var yV,bV=h(()=>{I();I();ft();xV();yV={kernelName:Ji,backendName:"cpu",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{x:o}=r,{filterSize:n,strides:s,pad:a,includeBatchInIndex:i}=t,c=e;Y(o,"MaxPoolWithArgmax");let l=c.data.get(o.dataId).values,u=k.computePool2DInfo(o.shape,n,s,[1,1],a),[p,m]=gV(l,o.shape,o.dtype,i,u),f=c.write(p,u.outShape,o.dtype),d=c.write(m,u.outShape,o.dtype);return[{dataId:f,shape:u.outShape,dtype:o.dtype},{dataId:d,shape:u.outShape,dtype:"int32"}]}}});function BJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o,i=b.parseAxisParam(s,n.shape),l=k.computeOutAndReduceShapes(n.shape,i)[1],u=b.sizeFromShape(l),p=[],m=e.makeTensorInfo([],"float32",new Float32Array([u]));p.push(m);let f=lo({inputs:{x:n},backend:e,attrs:{dtype:"float32"}});p.push(f);let d=Cp({inputs:{a:f,b:m},backend:e});p.push(d);let x=Sn({inputs:{x:d},backend:e,attrs:{axis:s,keepDims:a}});return p.forEach(g=>e.disposeIntermediateTensorInfo(g)),x}var vV,wV=h(()=>{I();qa();Np();Kl();vV={kernelName:tc,backendName:"cpu",kernelFunc:BJ}});function VJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:a}=o;Y(n,"min");let i=b.parseAxisParam(s,n.shape),c=i,l=k.getAxesPermutation(c,n.shape.length),u=n;l!=null&&(u=ce({inputs:{x:n},backend:e,attrs:{perm:l}}),c=k.getInnerMostAxes(c.length,n.shape.length)),k.assertAxesAreInnerMostDims("min",c,u.shape.length);let[p,m]=k.computeOutAndReduceShapes(u.shape,c),f=b.sizeFromShape(m),d=b.makeZerosTypedArray(b.sizeFromShape(p),u.dtype),x=e.data.get(u.dataId).values;for(let y=0;y<d.length;++y){let v=y*f,N=x[v];for(let S=0;S<f;++S){let R=x[v+S];(Number.isNaN(R)||R<N)&&(N=R)}d[y]=N}l!=null&&e.disposeIntermediateTensorInfo(u);let g=e.makeTensorInfo(p,u.dtype,d);if(a){let y=k.expandShapeToKeepDim(p,i),v=At({inputs:{x:g},backend:e,attrs:{shape:y}});return e.disposeIntermediateTensorInfo(g),v}return g}var CV,SV=h(()=>{I();ft();Ue();Or();CV={kernelName:"Min",backendName:"cpu",kernelFunc:VJ}});function zJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{paddings:s,mode:a}=o;Y(n,"mirrorPad");let i=s.map((N,S)=>N[0]+n.shape[S]+N[1]),c=s.map(N=>N[0]),l=s.map((N,S)=>N[0]+n.shape[S]),u=a==="reflect"?0:1,p=e.data.get(n.dataId).values,m=n.shape.length,f=b.computeStrides(n.shape),d=b.sizeFromShape(i),x=i.length,g=b.computeStrides(i),y=b.getTypedArrayFromDType(n.dtype,d);for(let N=0;N<d;N++){let S=b.indexToLoc(N,x,g);for(let A=0;A<x;A++)S[A]<c[A]?S[A]=c[A]*2-S[A]-u:S[A]>=l[A]&&(S[A]=(l[A]-1)*2-S[A]+u);S=S.map((A,_)=>A-c[_]);let R=b.locToIndex(S,m,f);y[N]=p[R]}return{dataId:e.write(y,i,n.dtype),shape:i,dtype:n.dtype}}var NV,TV=h(()=>{I();ft();NV={kernelName:ec,backendName:"cpu",kernelFunc:zJ}});var GJ,WJ,IV,kV=h(()=>{I();we();$e();GJ=Rt(((r,t)=>{let e=r%t;return r<0&&t<0||r>=0&&t>=0?e:(e+t)%t})),WJ=Ot("Mod",GJ),IV={kernelName:"Mod",backendName:"cpu",kernelFunc:WJ}});function Xv(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{dim:s}=o,a=n.shape.length,i=s;if(i===-1&&(i=a-1),i!==a-1)throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${a} and dim was ${i}`);let c=b.parseAxisParam([i],n.shape),l=Kv({inputs:{x:n},backend:e,attrs:{reductionIndices:c,keepDims:!1}}),u=k.expandShapeToKeepDim(l.shape,c),p=At({inputs:{x:l},backend:e,attrs:{shape:u}}),m=cp({inputs:{a:n,b:p},backend:e}),f=Eb({inputs:{x:m},backend:e}),d=Sn({inputs:{x:f},backend:e,attrs:{axis:c,keepDims:!1}}),x=At({inputs:{x:d},backend:e,attrs:{shape:u}}),g=Cp({inputs:{a:f,b:x},backend:e});return e.disposeIntermediateTensorInfo(l),e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(x),g}var EV,jv=h(()=>{I();fd();qv();Np();Ue();lp();Kl();EV={kernelName:Ec,backendName:"cpu",kernelFunc:Xv}});function UJ(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{numSamples:s,seed:a,normalized:i}=o;Y(n,"multinomial");let c=i?n:Xv({inputs:{logits:n},backend:e,attrs:{dim:-1}}),l=c.shape[0],u=c.shape[1],p=e.data.get(c.dataId).values,m=[l,s],f=b.makeZerosTypedArray(b.sizeFromShape(m),"int32");for(let d=0;d<l;++d){let x=d*u,g=new Float32Array(u-1);g[0]=p[x];for(let N=1;N<g.length;++N)g[N]=g[N-1]+p[x+N];let y=$V.alea(a.toString()),v=d*s;for(let N=0;N<s;++N){let S=y();f[v+N]=g.length;for(let R=0;R<g.length;R++)if(S<g[R]){f[v+N]=R;break}}}return i||e.disposeIntermediateTensorInfo(c),e.makeTensorInfo(m,"int32",f)}var $V,RV,AV=h(()=>{I();$V=Wg(Cy());ft();jv();RV={kernelName:rc,backendName:"cpu",kernelFunc:UJ}});function KJ(r){let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c}=o;Y(n,"NonMaxSuppression");let l=e.data.get(n.dataId).values,u=e.data.get(s.dataId).values,{selectedIndices:p}=HJ(l,u,a,i,c);return e.makeTensorInfo([p.length],"int32",new Int32Array(p))}var HJ,_V,DV=h(()=>{I();ft();HJ=Ye.nonMaxSuppressionV3Impl;_V={kernelName:oc,backendName:"cpu",kernelFunc:KJ}});function XJ(r){let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c,padToMaxOutputSize:l}=o;Y(n,"NonMaxSuppressionPadded");let u=e.data.get(n.dataId).values,p=e.data.get(s.dataId).values,{selectedIndices:m,validOutputs:f}=qJ(u,p,a,i,c,l);return[e.makeTensorInfo([m.length],"int32",new Int32Array(m)),e.makeTensorInfo([],"int32",new Int32Array([f]))]}var qJ,FV,OV=h(()=>{I();ft();qJ=Ye.nonMaxSuppressionV4Impl;FV={kernelName:nc,backendName:"cpu",kernelFunc:XJ}});function YJ(r){let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:a,iouThreshold:i,scoreThreshold:c,softNmsSigma:l}=o;Y(n,"NonMaxSuppressionWithScore");let u=e.data.get(n.dataId).values,p=e.data.get(s.dataId).values,m=a,f=i,d=c,x=l,{selectedIndices:g,selectedScores:y}=jJ(u,p,m,f,d,x);return[e.makeTensorInfo([g.length],"int32",new Int32Array(g)),e.makeTensorInfo([y.length],"float32",new Float32Array(y))]}var jJ,PV,LV=h(()=>{I();ft();jJ=Ye.nonMaxSuppressionV5Impl;PV={kernelName:sc,backendName:"cpu",kernelFunc:YJ}});function ZJ(r){let{inputs:t,backend:e,attrs:o}=r,{indices:n}=t,{dtype:s,depth:a,onValue:i,offValue:c}=o;Y(n,"oneHot");let l=b.sizeFromShape(n.shape),u=new Float32Array(l*a);u.fill(c);let p=e.data.get(n.dataId).values;for(let m=0;m<l;++m)p[m]>=0&&p[m]<a&&(u[m*a+p[m]]=i);return e.makeTensorInfo([...n.shape,a],s,u)}var MV,BV=h(()=>{I();ft();MV={kernelName:ic,backendName:"cpu",kernelFunc:ZJ}});function Ip(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="string")throw new Error("zerosLike is not supported for string tensors");if(o.dtype==="complex64"){let n=co({inputs:{input:o},backend:e}),s=Ip({inputs:{x:n},backend:e}),a=Zo({inputs:{input:o},backend:e}),i=Ip({inputs:{x:a},backend:e}),c=Ee({inputs:{real:s,imag:i},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(i),c}else return Tp({backend:e,attrs:{shape:o.shape,value:0,dtype:o.dtype}})}var VV,Yv=h(()=>{I();yn();bg();Hl();Ka();VV={kernelName:Wc,backendName:"cpu",kernelFunc:Ip}});function zV(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="string")throw new Error("onesLike is not supported for string tensors");if(o.dtype==="complex64"){let n=co({inputs:{input:o},backend:e}),s=zV({inputs:{x:n},backend:e}),a=Zo({inputs:{input:o},backend:e}),i=Ip({inputs:{x:a},backend:e}),c=Ee({inputs:{real:s,imag:i},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(i),c}else return Tp({backend:e,attrs:{shape:o.shape,value:1,dtype:o.dtype}})}var GV,WV=h(()=>{I();yn();bg();Hl();Ka();Yv();GV={kernelName:ac,backendName:"cpu",kernelFunc:zV}});function Zv(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o;if(t.length===1)return ql({inputs:{input:t[0]},backend:e,attrs:{dim:n}});let s=t[0].shape,a=t[0].dtype;t.forEach(u=>{b.assertShapesMatch(s,u.shape,"All tensors passed to stack must have matching shapes"),b.assert(a===u.dtype,()=>"All tensors passed to stack must have matching dtypes")});let i=[],c=t.map(u=>{let p=ql({inputs:{input:u},backend:e,attrs:{dim:n}});return i.push(p),p}),l=is({inputs:c,backend:e,attrs:{axis:n}});return i.forEach(u=>e.disposeIntermediateTensorInfo(u)),l}var UV,Qv=h(()=>{I();gg();xg();UV={kernelName:cc,backendName:"cpu",kernelFunc:Zv}});function QJ(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{paddings:s,constantValue:a}=o;Y(n,"pad");let i=s.map((v,N)=>v[0]+n.shape[N]+v[1]),c=s.map(v=>v[0]),l=e.data.get(n.dataId).values,u=b.sizeFromShape(n.shape),p=n.shape.length,m=b.computeStrides(n.shape),f=b.sizeFromShape(i),d=i.length,x=b.computeStrides(i),g=b.getTypedArrayFromDType(n.dtype,f);a!==0&&g.fill(a);for(let v=0;v<u;v++){let S=b.indexToLoc(v,p,m).map((A,_)=>A+c[_]),R=b.locToIndex(S,d,x);g[R]=l[v]}return{dataId:e.write(g,i,n.dtype),shape:i,dtype:n.dtype}}var vg,Jv=h(()=>{I();ft();vg={kernelName:lc,backendName:"cpu",kernelFunc:QJ}});var JJ,ttt,HV,KV=h(()=>{I();we();$e();JJ=Rt((r,t)=>Math.pow(r,t)),ttt=Ot("Pow",JJ),HV={kernelName:"Pow",backendName:"cpu",kernelFunc:ttt}});function ett(r){let{inputs:t,backend:e,attrs:o}=r,{paramsNestedSplits:n,paramsDenseValues:s,indices:a}=t,{outputRaggedRank:i}=o,c=n.map(y=>e.data.get(y.dataId).values),l=n.map(y=>y.shape),u=e.data.get(s.dataId).values,p=e.data.get(a.dataId).values,[m,f,d]=bd(c,l,u,s.shape,s.dtype,p,a.shape,i),x=m.map(y=>e.makeTensorInfo([y.length],"int32",y)),g=e.makeTensorInfo(d,s.dtype,f);return x.concat([g])}var qV,XV=h(()=>{I();s0();qV={kernelName:mc,backendName:"cpu",kernelFunc:ett}});function rtt(r){let{inputs:t,backend:e}=r,{starts:o,limits:n,deltas:s}=t,a=e.data.get(o.dataId).values,i=e.data.get(n.dataId).values,c=e.data.get(s.dataId).values,[l,u]=vd(a,o.shape,o.dtype,i,n.shape,c,s.shape),p=e.makeTensorInfo([l.length],"int32",l),m=e.makeTensorInfo([u.length],o.dtype,u);return[p,m]}var jV,YV=h(()=>{I();a0();jV={kernelName:fc,backendName:"cpu",kernelFunc:rtt}});function ott(r){let{inputs:t,backend:e,attrs:o}=r,{shape:n,values:s,defaultValue:a,rowPartitionTensors:i}=t,{rowPartitionTypes:c}=o,l=e.data.get(n.dataId).values,u=e.data.get(s.dataId).values,p=e.data.get(a.dataId).values,m=i.map(g=>e.data.get(g.dataId).values),f=i.map(g=>g.shape),[d,x]=wd(l,n.shape,u,s.shape,s.dtype,p,a.shape,m,f,c);return e.makeTensorInfo(d,s.dtype,x)}var ZV,QV=h(()=>{I();c0();ZV={kernelName:dc,backendName:"cpu",kernelFunc:ott}});function ntt(r){let{backend:t,attrs:e}=r,{start:o,stop:n,dtype:s,step:a}=e,i=Cd(o,n,a,s);return t.makeTensorInfo([i.length],s,i)}var JV,tz=h(()=>{I();l0();JV={kernelName:hc,backendName:"cpu",kernelFunc:ntt}});var stt,ez,rz=h(()=>{I();Pt();stt=yt(Ks,r=>1/r),ez={kernelName:Ks,backendName:"cpu",kernelFunc:stt}});function att(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:a,size:i}=o;Y(n,"resizeBilinear");let c=b.computeStrides(n.shape),[l,u]=i,[p,m,f,d]=n.shape,x=e.data.get(n.dataId).values,g=new Float32Array(b.sizeFromShape([p,l,u,d])),y=[s&&l>1?m-1:m,s&&u>1?f-1:f],v=[s&&l>1?l-1:l,s&&u>1?u-1:u],N=0,S=y[0]/v[0],R=y[1]/v[1];for(let A=0;A<p;A++)for(let _=0;_<l;_++){let D;a?D=S*(_+.5)-.5:D=S*_;let L=Math.max(0,Math.floor(D)),M=D-L,V=Math.min(m-1,Math.ceil(D)),W=A*c[0]+L*c[1],G=A*c[0]+V*c[1];for(let K=0;K<u;K++){let U;a?U=R*(K+.5)-.5:U=R*K;let j=Math.max(0,Math.floor(U)),Z=U-j,q=Math.min(f-1,Math.ceil(U)),Q=W+j*c[2],rt=G+j*c[2],et=W+q*c[2],st=G+q*c[2];for(let ot=0;ot<d;ot++){let at=x[Q+ot],nt=x[rt+ot],lt=x[et+ot],xt=x[st+ot],gt=at+(lt-at)*Z,ht=nt+(xt-nt)*Z,Ct=gt+(ht-gt)*M;g[N++]=Ct}}}return e.makeTensorInfo([p,l,u,d],"float32",g)}var oz,nz=h(()=>{I();ft();oz={kernelName:bc,backendName:"cpu",kernelFunc:att}});function itt(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:a}=o;Y([s,n],"resizeBilinearGrad");let i=b.computeStrides(n.shape),[c,l,u,p]=n.shape,[,m,f]=s.shape,d=new Float32Array(c*l*u*p),x=[a&&m>1?l-1:l,a&&f>1?u-1:u],g=[a&&m>1?m-1:m,a&&f>1?f-1:f],y=x[0]/g[0],v=x[1]/g[1],N=e.data.get(s.dataId).values,S=0;for(let R=0;R<c;R++){let A=R*i[0];for(let _=0;_<m;_++){let D=_*y,L=Math.floor(D),M=Math.min(Math.ceil(D),l-1),V=A+L*i[1],W=A+M*i[1],G=D-L,K=1-G;for(let U=0;U<f;U++){let j=U*v,Z=Math.floor(j),q=Math.min(Math.ceil(j),u-1),Q=j-Z,rt=1-Q,et=V+Z*i[2],st=V+q*i[2],ot=W+Z*i[2],at=W+q*i[2],nt=K*rt,lt=K*Q,xt=G*rt,gt=G*Q;for(let ht=0;ht<p;ht++){let Ct=N[S++];d[et+ht]+=Ct*nt,d[st+ht]+=Ct*lt,d[ot+ht]+=Ct*xt,d[at+ht]+=Ct*gt}}}}return e.makeTensorInfo([c,u,l,p],"float32",d)}var sz,az=h(()=>{I();ft();sz={kernelName:Zp,backendName:"cpu",kernelFunc:itt}});function ctt(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:a,size:i}=o;Y(n,"resizeNearestNeighbor");let c=b.computeStrides(n.shape),[l,u]=i,[p,m,f,d]=n.shape,x=e.data.get(n.dataId).values,g=new Float32Array(p*l*u*d),y=[s&&l>1?m-1:m,s&&u>1?f-1:f],v=[s&&l>1?l-1:l,s&&u>1?u-1:u],N=y[0]/v[0],S=y[1]/v[1],R=0;for(let A=0;A<p;A++){let _=A*c[0];for(let D=0;D<l;D++){let L=a?N*(D+.5):N*D,M=Math.min(m-1,s?Math.round(L):Math.floor(L));a&&(M=Math.max(0,M));let V=_+M*c[1];for(let W=0;W<u;W++){let G=a?S*(W+.5):S*W,K=Math.min(f-1,s?Math.round(G):Math.floor(G));a&&(K=Math.max(0,K));let U=V+K*c[2];for(let j=0;j<d;j++){let Z=x[U+j];g[R++]=Z}}}}return e.makeTensorInfo([p,l,u,d],n.dtype,g)}var iz,cz=h(()=>{I();ft();iz={kernelName:yc,backendName:"cpu",kernelFunc:ctt}});function ltt(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:a}=o;Y([s,n],"resizeNearestNeighborGrad");let i=b.computeStrides(n.shape),c=b.computeStrides(s.shape),[l,u,p,m]=n.shape,[,f,d]=s.shape,x=new Float32Array(l*u*p*m),g=e.data.get(s.dataId).values,y=[a&&f>1?u-1:u,a&&d>1?p-1:p],v=[a&&f>1?f-1:f,a&&d>1?d-1:d],N=y[0]/v[0],S=y[1]/v[1],R=1/N,A=1/S,_=Math.ceil(R)*2+2,D=Math.ceil(A)*2+2;for(let L=0;L<l;L++){let M=L*i[0];for(let V=0;V<u;V++){let W=M+V*i[1],G=Math.floor(V*R),K=Math.floor(G-_/2);for(let U=0;U<p;U++){let j=W+U*i[2],Z=Math.floor(U*A),q=Math.floor(Z-D/2);for(let Q=0;Q<m;Q++){let rt=0;for(let et=0;et<_;et++){let st=et+K;if(st<0||st>=f)continue;let ot=M+st*c[1],at=st*N,nt=Math.min(u-1,a?Math.round(at):Math.floor(at));if(V===nt)for(let lt=0;lt<D;lt++){let xt=lt+q;if(xt<0||xt>=d)continue;let gt=ot+xt*c[2],ht=xt*S,Ct=Math.min(p-1,a?Math.round(ht):Math.floor(ht));U===Ct&&(rt+=g[gt+Q])}}x[j+Q]=rt}}}}return e.makeTensorInfo(n.shape,n.dtype,x)}var lz,uz=h(()=>{I();ft();lz={kernelName:Yp,backendName:"cpu",kernelFunc:ltt}});function utt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dims:s}=o;Y(n,"reverse");let a=n.shape.length,i=b.parseAxisParam(s,n.shape);if(a===0)return Qe({inputs:{x:n},backend:e});let c=new Bt(n.shape,n.dtype),l=e.bufferSync(n);for(let u=0;u<c.size;u++){let p=c.indexToLoc(u),m=p.slice();i.forEach(f=>m[f]=n.shape[f]-1-m[f]),c.set(l.get(...m),...p)}return e.makeTensorInfo(c.shape,c.dtype,c.values)}var pz,mz=h(()=>{I();ft();qo();pz={kernelName:vc,backendName:"cpu",kernelFunc:utt}});var fz,dz=h(()=>{I();fz={kernelName:Uc,backendName:"cpu",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{image:o}=r,{radians:n,fillValue:s,center:a}=t,i=e,c=b.getTypedArrayFromDType(o.dtype,b.sizeFromShape(o.shape)),[l,u,p,m]=o.shape,[f,d]=k.getImageCenter(a,u,p),x=255,g=Math.sin(n),y=Math.cos(n),v=i.data.get(o.dataId).values;for(let S=0;S<l;S++){let R=S*p*u*m;for(let A=0;A<u;A++){let _=A*(p*m);for(let D=0;D<p;D++){let L=D*m;for(let M=0;M<m;M++){let V=[l,A,D,M],W=V[2],G=V[1],K=(W-f)*y-(G-d)*g,U=(W-f)*g+(G-d)*y;K=Math.round(K+f),U=Math.round(U+d);let j=s;if(typeof s!="number"&&(M===3?j=x:j=s[M]),K>=0&&K<p&&U>=0&&U<u){let q=U*(p*m),Q=K*m,rt=R+q+Q+M;j=v[rt]}let Z=R+_+L+M;c[Z]=j}}}}return{dataId:i.write(c,o.shape,o.dtype),shape:o.shape,dtype:o.dtype}}}});var ptt,hz,gz=h(()=>{I();Pt();ptt=yt(js,r=>{let t=Math.floor(r);return r-t<.5?Math.floor(r):r-t>.5?Math.ceil(r):t%2===0?t:t+1}),hz={kernelName:js,backendName:"cpu",kernelFunc:ptt}});function mtt(r){let{inputs:t,backend:e,attrs:o}=r,{indices:n,updates:s}=t,{shape:a}=o,{sliceRank:i,numUpdates:c,sliceSize:l,strides:u,outputSize:p}=k.calculateShapes(s,n,a),m=!0,f=e.bufferSync(n),d=e.bufferSync(s),x=So(f,d,a,p,l,c,i,u,0,m);return e.makeTensorInfo(a,x.dtype,x.values)}var xz,yz=h(()=>{I();ip();xz={kernelName:wc,backendName:"cpu",kernelFunc:mtt}});function ftt(r,t){let e=0,o=r.length,n=0;for(;e<o;)n=Math.floor((e+o)/2),r[n]<t?e=n+1:o=n;return o}function dtt(r,t){let e=0,o=r.length,n=0;for(;e<o;)n=Math.floor((e+o)/2),r[n]<=t?e=n+1:o=n;return o}function bz(r,t,e,o,n,s){let a=b.getArrayFromDType("int32",e*n);for(let i=0;i<e;++i){let c=r.slice(i*o,(i+1)*o),l=i*n;for(let u=0;u<n;++u)a[l+u]=s==="left"?ftt(c,t[u+l]):dtt(c,t[u+l])}return a}var vz=h(()=>{I();});function htt(r){let{inputs:t,backend:e,attrs:o}=r,{sortedSequence:n,values:s}=t,{side:a}=o,i=e.data.get(n.dataId).values,c=e.data.get(s.dataId).values,l=bz(i,c,n.shape[0],n.shape[1],s.shape[1],a);return e.makeTensorInfo(s.shape,"int32",l)}var wz,Cz=h(()=>{I();vz();wz={kernelName:Sc,backendName:"cpu",kernelFunc:htt}});function gtt(r){let{inputs:t,backend:e}=r,{condition:o,t:n,e:s}=t;Y([o,n,s],"select");let a=o.shape.length,i=e.data.get(o.dataId).values,c=e.data.get(n.dataId).values,l=e.data.get(s.dataId).values,u=be(n.dtype,s.dtype),p=b.makeZerosTypedArray(b.sizeFromShape(n.shape),u),m=0,f=a===0||a>1||n.shape.length===1?1:b.sizeFromShape(n.shape.slice(1));for(let d=0;d<i.length;d++)for(let x=0;x<f;x++)i[d]===1?p[m++]=c[d]:p[m++]=l[d];return e.makeTensorInfo(n.shape,u,p)}var Sz,Nz=h(()=>{I();ft();Sz={kernelName:Nc,backendName:"cpu",kernelFunc:gtt}});var xtt,ytt,btt,Tz,Iz=h(()=>{I();Pt();xtt=k.SELU_SCALEALPHA,ytt=k.SELU_SCALE,btt=yt(Zs,r=>r>=0?ytt*r:xtt*(Math.exp(r)-1)),Tz={kernelName:Zs,backendName:"cpu",kernelFunc:btt}});var vtt,kz,Ez=h(()=>{I();Pt();vtt=yt(Js,r=>r<0?-1:r>0?1:0),kz={kernelName:Js,backendName:"cpu",kernelFunc:vtt}});var wtt,$z,Rz=h(()=>{I();Pt();wtt=yt("Sin",r=>Math.sin(r)),$z={kernelName:"Sin",backendName:"cpu",kernelFunc:wtt}});var Ctt,Az,_z=h(()=>{I();Pt();Ctt=yt(Qs,r=>Math.sinh(r)),Az={kernelName:Qs,backendName:"cpu",kernelFunc:Ctt}});var Stt,Dz,Ntt,Fz,Oz=h(()=>{I();Pt();Stt=11920928955078125e-23,Dz=Math.log(Stt)+2,Ntt=yt(ea,r=>{let t=r>-Dz,e=r<Dz,o=Math.exp(r),n;return e?n=o:t?n=r:n=Math.log(1+o),n}),Fz={kernelName:ea,backendName:"cpu",kernelFunc:Ntt}});function Ttt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,paddings:a}=o;Y([n],"spaceToBatchND");let i=b.sizeFromShape(s),c=[[0,0]];c.push(...a);for(let A=1+s.length;A<n.shape.length;++A)c.push([0,0]);let l=vg.kernelFunc({inputs:{x:n},backend:e,attrs:{paddings:c,constantValue:0}}),u=k.getReshaped(l.shape,s,i,!1),p=k.getPermuted(u.length,s.length,!1),m=k.getReshapedPermuted(l.shape,s,i,!1),x=At({inputs:{x:l},backend:e,attrs:{shape:u}}),v=ce({inputs:{x},backend:e,attrs:{perm:p}}),R=At({inputs:{x:v},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(l),e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(v),R}var Pz,Lz=h(()=>{I();ft();Jv();Ue();Or();Pz={kernelName:Ic,backendName:"cpu",kernelFunc:Ttt}});function Itt(r){let{inputs:t,backend:e}=r,{indices:o,values:n,denseShape:s,defaultValue:a}=t;if(s.shape.length!==1)throw new Error(`Dense shape must be a vector, saw:
        ${s.shape}`);if(o.shape.length!==2)throw new Error(`Indices must be a matrix, saw:
        ${o.shape}`);if(n.shape.length!==1)throw new Error(`Values must be a vector, saw:
        ${n.shape}`);if(a.shape.length!==0)throw new Error(`Default value must be a scalar, saw:
        ${a.shape}`);let i=e.data.get(o.dataId).values,c=e.data.get(n.dataId).values,l=e.data.get(s.dataId).values,u=e.data.get(a.dataId).values[0],[p,m,f,d,x]=Nd(i,o.shape,o.dtype,c,n.dtype,l,u);return[e.makeTensorInfo(m,o.dtype,p),e.makeTensorInfo([m[0]],n.dtype,f),e.makeTensorInfo([d.length],"bool",new Uint8Array(d.map(g=>Number(g)))),e.makeTensorInfo([x.length],o.dtype,new Int32Array(x))]}var Mz,Bz=h(()=>{I();d0();Mz={kernelName:$c,backendName:"cpu",kernelFunc:Itt}});function ktt(r){let{inputs:t,backend:e}=r,{inputIndices:o,inputShape:n,newShape:s}=t;if(o.shape.length!==2)throw new Error(`Input indices should be a matrix but received shape
        ${o.shape}`);if(n.shape.length!==1)throw new Error(`Input shape should be a vector but received shape
        ${n.shape}`);if(s.shape.length!==1)throw new Error(`Target shape should be a vector but received shape ${s.shape}`);let a=Array.from(e.data.get(n.dataId).values),i=e.data.get(o.dataId).values,c=Array.from(e.data.get(s.dataId).values),[l,u,p]=Td(i,o.shape,o.dtype,a,c);return[e.makeTensorInfo(u,o.dtype,l),e.makeTensorInfo([p.length],s.dtype,new Int32Array(p))]}var Vz,zz=h(()=>{I();h0();Vz={kernelName:Rc,backendName:"cpu",kernelFunc:ktt}});function Ett(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
          ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
          ${s.shape}`);if(n.shape[0]!==s.shape[0])throw new Error("segmentIds and indices should have same size.");let a=e.data.get(o.dataId).values,i=e.data.get(n.dataId).values,c=e.data.get(s.dataId).values,[l,u]=Al(a,o.shape,o.dtype,i,c,!0);return e.makeTensorInfo(u,o.dtype,l)}var Gz,Wz=h(()=>{I();Id();Gz={kernelName:Ac,backendName:"cpu",kernelFunc:Ett}});function $tt(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
         ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
         ${s.shape}`);if(n.shape[0]!==s.shape[0])throw new Error("segmentIds and indices should have same size.");let a=e.data.get(o.dataId).values,i=e.data.get(n.dataId).values,c=e.data.get(s.dataId).values,[l,u]=Al(a,o.shape,o.dtype,i,c);return e.makeTensorInfo(u,o.dtype,l)}var Uz,Hz=h(()=>{I();Id();Uz={kernelName:_c,backendName:"cpu",kernelFunc:$tt}});function Rtt(r){let{inputs:t,backend:e,attrs:o}=r,{sparseIndices:n,sparseValues:s,defaultValue:a}=t,{outputShape:i}=o,{sliceRank:c,numUpdates:l,sliceSize:u,strides:p,outputSize:m}=k.calculateShapes(s,n,i),f=!1,d=e.bufferSync(n),x;switch(s.dtype){case"bool":{let g=e.bufferSync(s),y=!!e.data.get(a.dataId).values[0];x=So(d,g,i,m,u,l,c,p,y,f);break}case"float32":{let g=e.bufferSync(s),y=e.data.get(a.dataId).values[0];x=So(d,g,i,m,u,l,c,p,y,f);break}case"int32":{let g=e.bufferSync(s),y=e.data.get(a.dataId).values[0];x=So(d,g,i,m,u,l,c,p,y,f);break}case"string":{let g=e.bufferSync(s),y=b.decodeString(e.data.get(a.dataId).values[0]);x=So(d,g,i,m,u,l,c,p,y,f);break}default:throw new Error(`Unsupported type ${s.dtype}`)}return e.makeTensorInfo(i,x.dtype,x.values)}var Kz,qz=h(()=>{I();ip();Kz={kernelName:Dc,backendName:"cpu",kernelFunc:Rtt}});function Att(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{numOrSizeSplits:s,axis:a}=o,i=b.parseAxisParam(a,n.shape)[0],c=k.prepareSplitSize(n,s,i),l=new Array(n.shape.length).fill(0),u=n.shape.slice();return c.map(p=>{let m=[...u];m[i]=p;let f=po({inputs:{x:n},backend:e,attrs:{begin:l,size:m}});return l[i]+=p,f})}var Xz,jz=h(()=>{I();I();ts();Xz={kernelName:kc,backendName:"cpu",kernelFunc:Att}});var Yz,Zz=h(()=>{I();ft();Yz={kernelName:Qp,backendName:"cpu",kernelFunc:({inputs:r,backend:t})=>{let{x:e}=r,o=t;Y(e,"square");let n=o.data.get(e.dataId).values,s=new Float32Array(n.length);for(let i=0;i<n.length;++i){let c=n[i];s[i]=c*c}return{dataId:o.write(s,e.shape,e.dtype),shape:e.shape,dtype:e.dtype}}}});var _tt,Qz,Jz=h(()=>{I();Pt();_tt=yt(aa,(r,t)=>{let e=t;return isNaN(r)?NaN:r>0?1:e.alpha}),Qz={kernelName:aa,backendName:"cpu",kernelFunc:_tt}});function Dtt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,end:a,strides:i,beginMask:c,endMask:l,ellipsisMask:u,newAxisMask:p,shrinkAxisMask:m}=o;Y(n,"stridedSlice");let{finalShapeSparse:f,finalShape:d,isIdentity:x,sliceDim0:g,isSimpleSlice:y,begin:v,end:N,strides:S}=Fe.sliceInfo(n.shape,s,a,i,c,l,u,p,m),R;if(x)R=At({inputs:{x:n},backend:e,attrs:{shape:d}});else if(g||y){b.assert(n.shape.length>=1,()=>`Input must have rank at least 1, got: ${n.shape.length}`);let A=Fe.computeOutShape(v,N,S),_=po({inputs:{x:n},backend:e,attrs:{begin:v,size:A}});R=At({inputs:{x:_},backend:e,attrs:{shape:d}}),e.disposeIntermediateTensorInfo(_)}else{let A=e.bufferSync(n),_=kd(f,A,S,v);R=e.makeTensorInfo(d,_.dtype,_.values)}return R}var tG,eG=h(()=>{I();ft();Ue();ts();w0();tG={kernelName:Fc,backendName:"cpu",kernelFunc:Dtt}});function Ftt(r){let{inputs:t,backend:e,attrs:o}=r,{separator:n,nGramWidths:s,leftPad:a,rightPad:i,padWidth:c,preserveShortSequences:l}=o,{data:u,dataSplits:p}=t,m=e.data.get(u.dataId).values,f=e.data.get(p.dataId).values,[d,x]=Ed(m,f,n,s,a,i,c,l);return[e.makeTensorInfo([d.length],"string",d),e.makeTensorInfo(p.shape,"int32",x)]}var rG,oG=h(()=>{I();S0();rG={kernelName:Oc,backendName:"cpu",kernelFunc:Ftt}});function Ott(r){let{inputs:t,backend:e,attrs:o}=r,{skipEmpty:n}=o,{input:s,delimiter:a}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(s.shape.length!==1)throw new Error(`Input must be a vector, got shape: ${s.shape}`);if(a.shape.length!==0)throw new Error(`Delimiter must be a scalar, got shape: ${a.shape}`);let i=e.data.get(s.dataId).values,c=e.data.get(a.dataId).values[0],[l,u,p]=$d(i,c,n),m=u.length;return[e.makeTensorInfo([m,2],"int32",l),e.makeTensorInfo([m],"string",u),e.makeTensorInfo([2],"int32",new Int32Array(p))]}var nG,sG=h(()=>{I();N0();nG={kernelName:Pc,backendName:"cpu",kernelFunc:Ott}});function Ptt(r){let{inputs:t,backend:e,attrs:o}=r,{numBuckets:n}=o,{input:s}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(n<=0)throw new Error("Number of buckets must be at least 1");let a=e.data.get(s.dataId).values,i=Rd(a,n);return e.makeTensorInfo(s.shape,"int32",i)}var aG,iG=h(()=>{I();T0();aG={kernelName:Lc,backendName:"cpu",kernelFunc:Ptt}});var Ltt,cG,lG=h(()=>{I();Pt();Ltt=yt("Tan",r=>Math.tan(r)),cG={kernelName:"Tan",backendName:"cpu",kernelFunc:Ltt}});var Mtt,uG,pG=h(()=>{I();Pt();Mtt=yt(sa,r=>Math.tanh(r)),uG={kernelName:sa,backendName:"cpu",kernelFunc:Mtt}});function Btt(r){let{inputs:t,backend:e}=r,{tensor:o,indices:n,updates:s}=t,{sliceRank:a,numUpdates:i,sliceSize:c,strides:l,outputSize:u}=k.calculateShapes(s,n,o.shape),p=!1,m=e.bufferSync(n),f=e.bufferSync(s),d=e.bufferSync(o),x=So(m,f,o.shape,u,c,i,a,l,d,p);return e.makeTensorInfo(o.shape,x.dtype,x.values)}var mG,fG=h(()=>{I();ip();mG={kernelName:Cc,backendName:"cpu",kernelFunc:Btt}});function Vtt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reps:s}=o;Y(n,"tile");let a=Ad(e.bufferSync(n),s);return e.makeTensorInfo(a.shape,a.dtype,a.values)}var dG,hG=h(()=>{I();ft();k0();dG={kernelName:Rn,backendName:"cpu",kernelFunc:Vtt}});function ztt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{k:s,sorted:a}=o;Y(n,"topk");let i=e.data.get(n.dataId).values,[c,l]=_d(i,n.shape,n.dtype,s,a);return[e.makeTensorInfo(c.shape,c.dtype,c.values),e.makeTensorInfo(l.shape,l.dtype,l.values)]}var gG,xG=h(()=>{I();ft();E0();gG={kernelName:Mc,backendName:"cpu",kernelFunc:ztt}});function Gtt(r){let{inputs:t,attrs:e,backend:o}=r,{image:n,transforms:s}=t,{interpolation:a,fillMode:i,fillValue:c,outputShape:l}=e,[u,p,m,f]=n.shape,[d,x]=l!=null?l:[p,m],g=[u,d,x,f],y=b.computeStrides(n.shape),v=y[0],N=y[1],S=y[2],R=b.computeStrides(g),A=R[0],_=R[1],D=R[2],L=b.getTypedArrayFromDType(n.dtype,b.sizeFromShape(g));L.fill(c);let M=o.data.get(n.dataId).values,V=o.data.get(s.dataId).values;for(let G=0;G<u;++G){let K=s.shape[0]===1?V:V.subarray(G*8,G*8+8);for(let U=0;U<d;++U)for(let j=0;j<x;++j)for(let Z=0;Z<f;++Z){let q,Q=K[6]*j+K[7]*U+1;if(Q===0)continue;let rt=(K[0]*j+K[1]*U+K[2])/Q,et=(K[3]*j+K[4]*U+K[5])/Q,st=yG(rt,m,i),ot=yG(et,p,i);switch(a){case"nearest":q=qtt(M,p,m,v,N,S,G,ot,st,Z,c);break;case"bilinear":q=Xtt(M,p,m,v,N,S,G,ot,st,Z,c);break;default:throw new Error(`Error in Transform: Expect 'nearest' or 'bilinear', but got ${a}`)}let at=G*A+U*_+j*D+Z;L[at]=q}return o.makeTensorInfo(g,n.dtype,L)}return{dataId:o.write(L,g,n.dtype),shape:n.shape,dtype:n.dtype}}function yG(r,t,e){switch(e){case"reflect":return Wtt(r,t);case"wrap":return Utt(r,t);case"nearest":return Ktt(r,t);default:return Htt(r,t)}}function Wtt(r,t){let e=r;if(e<0)if(t<=1)e=0;else{let o=2*t;e<o&&(e=o*Math.trunc(-e/o)+e),e=e<-t?e+o:-e-1}else if(e>t-1)if(t<=1)e=0;else{let o=2*t;e-=o*Math.trunc(e/o),e>=t&&(e=o-e-1)}return b.clamp(0,e,t-1)}function Utt(r,t){let e=r;if(e<0)if(t<=1)e=0;else{let o=t-1;e+=t*(Math.trunc(-e/o)+1)}else if(e>t-1)if(t<=1)e=0;else{let o=t-1;e-=t*Math.trunc(e/o)}return b.clamp(0,e,t-1)}function Htt(r,t){return r}function Ktt(r,t){return b.clamp(0,r,t-1)}function kp(r,t,e,o,n,s,a,i,c,l,u){let p=a*o+i*n+c*s+l;return 0<=i&&i<t&&0<=c&&c<e?r[p]:u}function qtt(r,t,e,o,n,s,a,i,c,l,u){let p=Math.round(i),m=Math.round(c);return kp(r,t,e,o,n,s,a,p,m,l,u)}function Xtt(r,t,e,o,n,s,a,i,c,l,u){let p=Math.floor(i),m=Math.floor(c),f=p+1,d=m+1,x=(d-c)*kp(r,t,e,o,n,s,a,p,m,l,u)+(c-m)*kp(r,t,e,o,n,s,a,p,d,l,u),g=(d-c)*kp(r,t,e,o,n,s,a,f,m,l,u)+(c-m)*kp(r,t,e,o,n,s,a,f,d,l,u);return(f-i)*x+(i-p)*g}var bG,vG=h(()=>{I();bG={kernelName:Bc,backendName:"cpu",kernelFunc:Gtt}});function jtt(r){let{inputs:t,attrs:e,backend:o}=r,{axis:n}=e,{x:s}=t;Y(s,"unique");let a=o.data.get(s.dataId).values,{outputValues:i,outputShape:c,indices:l}=Dd(a,n,s.shape,s.dtype);return[o.makeTensorInfo(c,s.dtype,i),o.makeTensorInfo([l.length],"int32",l)]}var wG,CG=h(()=>{I();ft();$0();wG={kernelName:Vc,backendName:"cpu",kernelFunc:jtt}});function Ytt(r){let{inputs:t,backend:e,attrs:o}=r,{value:n}=t,{axis:s}=o;s<0&&(s+=n.shape.length);let a=n.shape.length,i=n.shape[s],c=new Array(a-1),l=0;for(let f=0;f<a;f++)f!==s&&(c[l++]=n.shape[f]);let u=new Array(a).fill(0),p=n.shape.slice();p[s]=1;let m=new Array(i);for(let f=0;f<m.length;f++){u[s]=f;let d=po({inputs:{x:n},backend:e,attrs:{begin:u,size:p}});m[f]=At({inputs:{x:d},backend:e,attrs:{shape:c}}),e.disposeIntermediateTensorInfo(d)}return m}var SG,NG=h(()=>{I();Ue();ts();SG={kernelName:zc,backendName:"cpu",kernelFunc:Ytt}});function Ztt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,segmentIds:s}=t,{numSegments:a}=o;Y(n,"unsortedSegmentSum");let i=n.shape.length,c=s.shape.length,l=[],u=[],p=i-c,m=s;for(let d=0;d<p;++d){let x=ql({inputs:{input:m},backend:e,attrs:{dim:d+1}});m=x,u.push(x)}for(let d=0;d<a;++d){let x=b.createScalarValue(d,"int32"),g=e.makeTensorInfo([],"int32",x),y=Ib({inputs:{a:g,b:m},backend:e}),v=lo({inputs:{x:y},backend:e,attrs:{dtype:"float32"}}),N=ja({inputs:{a:v,b:n},backend:e}),S=Sn({inputs:{x:N},backend:e,attrs:{axis:0,keepDims:!1}});l.push(S),u.push(g),u.push(y),u.push(v),u.push(N),u.push(S)}let f=Zv({inputs:l,backend:e,attrs:{axis:0}});return u.forEach(d=>e.disposeIntermediateTensorInfo(d)),f}var TG,IG=h(()=>{I();ft();qa();md();xg();Ya();Qv();Kl();TG={kernelName:Gc,backendName:"cpu",kernelFunc:Ztt}});var Qtt,kG=h(()=>{I();M3();gb();V3();G3();Xa();U3();K3();X3();Y3();Q3();tM();rM();nM();aM();cM();pM();fM();hM();xM();Bv();bM();wM();SM();wb();TM();qa();Sb();kM();yn();$M();gg();zv();FM();PM();MM();VM();GM();UM();KM();XM();YM();QM();tB();rB();Wv();sB();iB();lB();pB();fB();hB();xB();vB();$v();CB();md();NB();fd();xg();Rb();kB();bg();RB();_b();Fb();_B();FB();PB();MB();Mb();Vb();qo();VB();Hl();GB();UB();KB();Av();Gb();Ub();XB();qb();YB();QB();tV();rV();nV();aV();qv();Yb();lV();pV();fV();hV();bV();wV();SV();Qb();TV();kV();AV();Ya();t0();DV();OV();LV();r0();BV();WV();Qv();Jv();KV();Dv();n0();XV();YV();QV();tz();Ka();Np();rz();Ov();Lv();Ue();nz();az();cz();uz();mz();dz();gz();p0();yz();Cz();Nz();Iz();Sd();Ez();Rz();_z();ts();jv();Oz();Lz();Bz();zz();Wz();Hz();qz();jz();g0();Zz();y0();v0();Jz();eG();oG();sG();iG();lp();Kl();lG();pG();fG();hG();xG();vG();Or();CG();NG();IG();Yv();Qtt=[L3,a$,B3,z3,p$,W3,H3,q3,j3,Z3,J3,eM,oM,sM,iM,uM,mM,dM,gM,P3,yM,vM,CM,m$,NM,u$,f$,IM,i$,EM,AM,_M,DM,OM,LM,BM,zM,WM,HM,qM,jM,ZM,JM,eB,oB,nB,aB,cB,uB,mB,dB,gB,bB,R3,wB,d$,SB,h$,TB,g$,IB,EB,$B,x$,y$,AB,DB,OB,LB,b$,v$,c$,BB,RM,zB,WB,HB,A3,w$,C$,qB,S$,jB,ZB,JB,eV,oV,sV,iV,N$,cV,uV,mV,dV,yV,vV,CV,T$,NV,IV,RV,I$,k$,_V,FV,PV,E$,MV,GV,UV,vg,HV,_3,R$,qV,jV,ZV,JV,l$,Sp,ez,D3,F3,O3,oz,sz,iz,lz,pz,fz,hz,O$,xz,wz,Sz,Tz,L$,kz,$z,Az,M$,EV,Fz,Pz,Mz,Vz,Gz,Uz,Kz,Xz,V$,Yz,z$,G$,Qz,tG,rG,nG,aG,W$,yB,cG,uG,mG,dG,gG,bG,$$,wG,SG,TG,VV];for(let r of Qtt)em(r)});var EG=h(()=>{$3();kG();});var Jtt,$G=h(()=>{I();Jtt=O();Jtt.registerFlag("KEEP_INTERMEDIATE_TENSORS",()=>!1,r=>{r&&console.warn("Keep intermediate tensors is ON. This will print the values of all intermediate tensors during model inference. Not all models support this mode. For details, check e2e/benchmarks/ model_config.js. This significantly impacts performance.")})});var Nr,RG,AG=h(()=>{(function(r){r[r.DT_INVALID=0]="DT_INVALID",r[r.DT_FLOAT=1]="DT_FLOAT",r[r.DT_DOUBLE=2]="DT_DOUBLE",r[r.DT_INT32=3]="DT_INT32",r[r.DT_UINT8=4]="DT_UINT8",r[r.DT_INT16=5]="DT_INT16",r[r.DT_INT8=6]="DT_INT8",r[r.DT_STRING=7]="DT_STRING",r[r.DT_COMPLEX64=8]="DT_COMPLEX64",r[r.DT_INT64=9]="DT_INT64",r[r.DT_BOOL=10]="DT_BOOL",r[r.DT_QINT8=11]="DT_QINT8",r[r.DT_QUINT8=12]="DT_QUINT8",r[r.DT_QINT32=13]="DT_QINT32",r[r.DT_BFLOAT16=14]="DT_BFLOAT16",r[r.DT_QINT16=15]="DT_QINT16",r[r.DT_QUINT16=16]="DT_QUINT16",r[r.DT_UINT16=17]="DT_UINT16",r[r.DT_COMPLEX128=18]="DT_COMPLEX128",r[r.DT_HALF=19]="DT_HALF",r[r.DT_RESOURCE=20]="DT_RESOURCE",r[r.DT_VARIANT=21]="DT_VARIANT",r[r.DT_UINT32=22]="DT_UINT32",r[r.DT_UINT64=23]="DT_UINT64",r[r.DT_FLOAT_REF=101]="DT_FLOAT_REF",r[r.DT_DOUBLE_REF=102]="DT_DOUBLE_REF",r[r.DT_INT32_REF=103]="DT_INT32_REF",r[r.DT_UINT8_REF=104]="DT_UINT8_REF",r[r.DT_INT16_REF=105]="DT_INT16_REF",r[r.DT_INT8_REF=106]="DT_INT8_REF",r[r.DT_STRING_REF=107]="DT_STRING_REF",r[r.DT_COMPLEX64_REF=108]="DT_COMPLEX64_REF",r[r.DT_INT64_REF=109]="DT_INT64_REF",r[r.DT_BOOL_REF=110]="DT_BOOL_REF",r[r.DT_QINT8_REF=111]="DT_QINT8_REF",r[r.DT_QUINT8_REF=112]="DT_QUINT8_REF",r[r.DT_QINT32_REF=113]="DT_QINT32_REF",r[r.DT_BFLOAT16_REF=114]="DT_BFLOAT16_REF",r[r.DT_QINT16_REF=115]="DT_QINT16_REF",r[r.DT_QUINT16_REF=116]="DT_QUINT16_REF",r[r.DT_UINT16_REF=117]="DT_UINT16_REF",r[r.DT_COMPLEX128_REF=118]="DT_COMPLEX128_REF",r[r.DT_HALF_REF=119]="DT_HALF_REF",r[r.DT_RESOURCE_REF=120]="DT_RESOURCE_REF",r[r.DT_VARIANT_REF=121]="DT_VARIANT_REF",r[r.DT_UINT32_REF=122]="DT_UINT32_REF",r[r.DT_UINT64_REF=123]="DT_UINT64_REF"})(Nr||(Nr={}));(function(r){let t;(function(e){e[e.LEGACY=0]="LEGACY",e[e.V1=1]="V1",e[e.V2=2]="V2"})(t=r.CheckpointFormatVersion||(r.CheckpointFormatVersion={}))})(RG||(RG={}))});function wg(r){return eet[r]}var eet,Cg=h(()=>{eet={}});function w(r,t,e,o,n){let s=t.inputParams[r];if(s&&s.inputIndexStart!==void 0){let i=s.inputIndexStart,c=s.inputIndexEnd===0?void 0:s.inputIndexEnd===void 0?i+1:s.inputIndexEnd,l=i<0?t.inputNames.length+i:i;if(s.type==="tensor")return Ce(t.inputNames[l],e,o,n);if(s.type==="tensors"){let m=t.inputs.slice(i,c);return t.inputNames.slice(i,c).filter((d,x)=>{var g;return((g=m[x])===null||g===void 0?void 0:g.op)!=="NoOp"}).map(d=>Ce(d,e,o,n))}let u=Ce(t.inputNames[l],e,o,n),p=u.dataSync();return s.type==="number"?p[0]:b.toNestedArray(u.shape,p)}let a=t.attrParams[r];return a&&a.value}function Ce(r,t,e,o){let[n,s]=lr(r,e);if(o!=null){let i=o.getHashTableHandleByName(n);if(i!=null)return i}let a=e.currentContextIds.find(i=>!!t[Sg(n,i)]);return a!==void 0?t[Sg(n,a)][s]:void 0}function tw(r,t,e){return t[Sg(r,e.currentContextId)]}function ko(r,t){let[e,o,n]=lr(r,t);return[Sg(e,t&&t.currentContextId),o,n]}function Sg(r,t){return t?`${r}-${t}`:r}function lr(r,t){if(r==="")return["",0,void 0];let e=t!=null&&t.parseNodeNameCache!=null;if(e){let s=t.parseNodeNameCache.get(r);if(s!=null)return s}let o=r.split(":"),n;if(o.length===1)n=[r,0,void 0];else{let s=o[0],a=o.length===3?o[1]:void 0,i=Number(o[o.length-1]);n=[s,i,a]}return e&&t.parseNodeNameCache.set(r,n),n}function Ep(r,t,e){let o=w("pad",r,t,e);if(o==="explicit"){o=w("explicitPaddings",r,t,e);let n=[[0,0],[0,0],[0,0],[0,0]];for(let s=0;s<4;s++)n[s][0]=o[s*2],n[s][1]=o[s*2+1];return n}return o}function Eo(r){return r.kept?r:dr(r)}var xe=h(()=>{I();});var ew={};Yt(ew,{json:()=>ret});var ret,_G=h(()=>{ret=[{tfOpName:"Add",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddV2",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddN",category:"arithmetic",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"BiasAdd",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"Sub",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"RealDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Div",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"DivNoNan",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mul",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Maximum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Minimum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Pow",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SquaredDifference",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorMod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}]});var rw={};Yt(rw,{json:()=>oet});var oet,DG=h(()=>{oet=[{tfOpName:"Abs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan2",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Ceil",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ClipByValue",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"clipValueMin",type:"number"},{start:2,name:"clipValueMax",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Complex",category:"basic_math",inputs:[{start:0,name:"real",type:"tensor"},{start:1,name:"imag",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ComplexAbs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Elu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Exp",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Floor",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Imag",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Neg",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Real",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Prelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"alpha",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu6",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Selu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sigmoid",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Rsqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Square",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sign",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Round",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Expm1",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log1p",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Reciprocal",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Softplus",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Erf",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LeakyRelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"alpha",name:"alpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsNan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsFinite",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsInf",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}]});var ow={};Yt(ow,{json:()=>net});var net,FG=h(()=>{net=[{tfOpName:"EmptyTensorList",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"maxNumElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"LoopCond",category:"control",inputs:[{start:0,name:"pred",type:"tensor"}]},{tfOpName:"Switch",category:"control",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"pred",type:"tensor"}]},{tfOpName:"Merge",category:"control",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"Enter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"frame_name",name:"frameName",type:"string"},{tfName:"is_constant",name:"isConstant",type:"bool"}]},{tfOpName:"Exit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NextIteration",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayV3",category:"control",inputs:[{start:0,name:"size",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"dynamic_size",name:"dynamicSize",type:"bool"},{tfName:"clear_after_read",name:"clearAfterRead",type:"bool"},{tfName:"identical_element_shapes",name:"identicalElementShapes",type:"bool"},{tfName:"tensor_array_name",name:"name",type:"string"}]},{tfOpName:"TensorArrayWriteV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayReadV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayGatherV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"}]},{tfOpName:"TensorArrayScatterV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArrayConcatV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape_except0",name:"elementShapeExcept0",type:"shape",notSupported:!0}]},{tfOpName:"TensorArraySplitV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"tensor",type:"tensor"},{start:2,name:"lengths",type:"number[]"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArraySizeV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}]},{tfOpName:"TensorArrayCloseV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"}]},{tfOpName:"StatelessIf",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"If",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"StatelessWhile",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"While",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"TensorListScatter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListScatterV2",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"},{start:3,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGather",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListSetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListReserve",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListFromTensor",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListStack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"},{tfName:"num_elements",name:"numElements",type:"dtype"}]},{tfOpName:"TensorListSplit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"},{start:2,name:"lengths",type:"number[]"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcat",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcatV2",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPopBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPushBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListLength",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}]},{tfOpName:"TensorListResize",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"size",type:"number"}]}]});var nw={};Yt(nw,{json:()=>set});var set,OG=h(()=>{set=[{tfOpName:"AvgPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[],notSupported:!0},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPoolWithArgmax",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"include_batch_in_index",name:"includeBatchInIndex",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AvgPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Conv1D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"stride",name:"stride",type:"number"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NWC"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"dilation",name:"dilation",type:"number",defaultValue:1}]},{tfOpName:"Conv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"useCudnnOnGpu",name:"useCudnnOnGpu",type:"bool"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"_FusedConv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"use_cudnn_on_gpu",name:"useCudnnOnGpu",type:"bool",defaultValue:!0},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2}]},{tfOpName:"Conv2DBackpropInput",category:"convolution",inputs:[{start:2,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:0,name:"outputShape",type:"number[]"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]",notSupported:!0}]},{tfOpName:"DepthwiseConv2d",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"DepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"FusedDepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]}]},{tfOpName:"Conv3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"Dilation2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"rates",name:"dilations",type:"number[]"},{tfName:"padding",name:"pad",type:"string"}]}]});var sw={};Yt(sw,{json:()=>aet});var aet,PG=h(()=>{aet=[{tfOpName:"Fill",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"},{start:1,name:"value",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"LinSpace",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"num",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"OneHot",category:"creation",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"depth",type:"number"},{start:2,name:"onValue",type:"number",defaultValue:1},{start:3,name:"offValue",type:"number",defaultValue:0}],attrs:[{tfName:"axis",name:"axis",type:"number",notSupported:!0},{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Ones",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"OnesLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"RandomStandardNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"RandomUniform",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"minval",name:"minval",type:"number",defaultValue:0},{tfName:"maxval",name:"maxval",type:"number",defaultValue:1},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"RandomUniformInt",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"minval",name:"minval",type:"number"},{tfName:"maxval",name:"maxval",type:"number"},{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0}]},{tfOpName:"Range",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"step",type:"number",defaultValue:0}],attrs:[{tfName:"Tidx",name:"dtype",type:"dtype"}]},{tfOpName:"TruncatedNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"means",name:"mean",type:"number",defaultValue:0},{tfName:"stddev",name:"stdDev",type:"number",defaultValue:1},{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"Zeros",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"ZerosLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Multinomial",category:"creation",inputs:[{start:0,name:"logits",type:"tensor"},{start:1,name:"numSamples",type:"number"}],attrs:[{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number"},{tfName:"T",name:"dtype",type:"dtype"},{tfName:"output_dtype",name:"output_dtype",type:"dtype"}]}]});var aw={};Yt(aw,{json:()=>iet});var iet,LG=h(()=>{iet=[{tfOpName:"NonMaxSuppressionV2",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV3",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV4",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"T_threshold",name:"threshold",type:"dtype",notSupported:!0},{tfName:"pad_to_max_output_size",name:"padToMaxOutputSize",type:"bool"}]},{tfOpName:"NonMaxSuppressionV5",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"},{start:5,name:"softNmsSigma",type:"number"}]},{tfOpName:"Where",category:"dynamic",inputs:[{start:0,name:"condition",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ListDiff",category:"dynamic",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}]});var iw={};Yt(iw,{json:()=>cet});var cet,MG=h(()=>{cet=[{tfOpName:"LowerBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"TopKV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"k",type:"number"}],attrs:[{tfName:"sorted",name:"sorted",type:"bool"}]},{tfOpName:"UpperBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"Unique",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"UniqueV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]}]});var cw={};Yt(cw,{json:()=>uet});var uet,BG=h(()=>{uet=[{tfOpName:"PlaceholderWithDefault",category:"graph",inputs:[{start:0,name:"default",type:"tensor"}],attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Placeholder",category:"graph",attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Const",category:"graph"},{tfOpName:"Identity",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IdentityN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Snapshot",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Rank",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Size",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Shape",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"ShapeN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Print",category:"graph",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"data",type:"tensors"}],attrs:[{tfName:"message",name:"message",type:"string"},{tfName:"first_n",name:"firstN",type:"number",notSupported:!0},{tfName:"summarize",name:"summarize",type:"number",defaultValue:3}]},{tfOpName:"NoOp",category:"graph",inputs:[]},{tfOpName:"StopGradient",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"FakeQuantWithMinMaxVars",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"min",name:"min",type:"number"},{tfName:"max",name:"max",type:"number"}]}]});var lw={};Yt(lw,{json:()=>pet});var pet,VG=h(()=>{pet=[{tfOpName:"HashTable",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"HashTableV2",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"LookupTableImport",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableImportV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFind",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFindV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableSize",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]},{tfOpName:"LookupTableSizeV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]},{tfOpName:"InitializeTable",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}]},{tfOpName:"InitializeTableV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}]}]});var uw={};Yt(uw,{json:()=>met});var met,zG=h(()=>{met=[{tfOpName:"ResizeBilinear",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ResizeNearestNeighbor",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"CropAndResize",category:"image",inputs:[{start:0,name:"image",type:"tensor"},{start:1,name:"boxes",type:"tensor"},{start:2,name:"boxInd",type:"tensor"},{start:3,name:"cropSize",type:"number[]"}],attrs:[{tfName:"method",name:"method",type:"string"},{tfName:"extrapolation_value",name:"extrapolationValue",type:"number"}]},{tfOpName:"ImageProjectiveTransformV3",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"transforms",type:"tensor"},{start:2,name:"outputShape",type:"number[]"},{start:3,name:"fillValue",type:"number"}],attrs:[{tfName:"interpolation",name:"interpolation",type:"string"},{tfName:"fill_mode",name:"fillMode",type:"string"}]}]});var pw={};Yt(pw,{json:()=>fet});var fet,GG=h(()=>{fet=[{tfOpName:"Equal",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NotEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Greater",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"GreaterEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Less",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LessEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalAnd",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalNot",category:"logical",inputs:[{start:0,name:"a",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalOr",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Select",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SelectV2",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BitwiseAnd",category:"logical",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}]}]});var mw={};Yt(mw,{json:()=>det});var det,WG=h(()=>{det=[{tfOpName:"_FusedMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMulV2",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Transpose",category:"matrices",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"perm",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Einsum",category:"matrices",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"equation",name:"equation",type:"string"},{tfName:"N",name:"n",type:"number",defaultValue:2},{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"MatrixBandPart",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"numLower",type:"tensor"},{start:1,name:"numUpper",type:"tensor"}]}]});var fw={};Yt(fw,{json:()=>het});var het,UG=h(()=>{het=[{tfOpName:"EuclideanNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool",defaultValue:!1}]},{tfOpName:"FusedBatchNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV2",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV3",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"LRN",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"depth_radius",name:"radius",type:"number",defaultValue:5},{tfName:"bias",name:"bias",type:"number",defaultValue:1},{tfName:"alpha",name:"alpha",type:"number",defaultValue:1},{tfName:"beta",name:"beta",type:"number",defaultValue:.5}]},{tfOpName:"Softmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"LogSoftmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]}]});var dw={};Yt(dw,{json:()=>get});var get,HG=h(()=>{get=[{tfOpName:"Bincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}]},{tfOpName:"DenseBincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}],attrs:[{tfName:"binary_output",name:"binaryOutput",type:"bool"}]},{tfOpName:"Max",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Mean",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Min",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Sum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"All",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Any",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"ArgMax",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"ArgMin",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"Prod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cumprod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]},{tfOpName:"Cumsum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]}]});var hw={};Yt(hw,{json:()=>xet});var xet,KG=h(()=>{xet=[{tfOpName:"ConcatV2",category:"slice_join",inputs:[{start:0,end:-1,name:"tensors",type:"tensors"},{start:-1,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"Concat",category:"slice_join",inputs:[{start:1,end:0,name:"tensors",type:"tensors"},{start:0,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"GatherV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"axis",type:"number",defaultValue:0}],attrs:[{tfName:"batch_dims",name:"batchDims",type:"number",defaultValue:0}]},{tfOpName:"Gather",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",notSupported:!0}]},{tfOpName:"Reverse",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"dims",type:"bool[]"}]},{tfOpName:"ReverseV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}]},{tfOpName:"Slice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"size",type:"number[]"}]},{tfOpName:"StridedSlice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"end",type:"number[]"},{start:3,name:"strides",type:"number[]"}],attrs:[{tfName:"begin_mask",name:"beginMask",type:"number",defaultValue:0},{tfName:"end_mask",name:"endMask",type:"number",defaultValue:0},{tfName:"new_axis_mask",name:"newAxisMask",type:"number",defaultValue:0},{tfName:"ellipsis_mask",name:"ellipsisMask",type:"number",defaultValue:0},{tfName:"shrink_axis_mask",name:"shrinkAxisMask",type:"number",defaultValue:0}]},{tfOpName:"Pack",category:"slice_join",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0}]},{tfOpName:"Unpack",category:"slice_join",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0},{tfName:"num",name:"num",type:"number",defaultValue:0,notSupported:!0}]},{tfOpName:"Tile",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"reps",type:"number[]"}]},{tfOpName:"Split",category:"slice_join",inputs:[{start:0,name:"axis",type:"number",defaultValue:0},{start:1,name:"x",type:"tensor"}],attrs:[{tfName:"num_split",name:"numOrSizeSplits",type:"number",defaultValue:1}]},{tfOpName:"SplitV",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"numOrSizeSplits",type:"number[]"},{start:2,name:"axis",type:"number",defaultValue:0}]},{tfOpName:"ScatterNd",category:"slice_join",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"shape",type:"number[]"}]},{tfOpName:"GatherNd",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}]},{tfOpName:"SparseToDense",category:"slice_join",inputs:[{start:0,name:"sparseIndices",type:"tensor"},{start:1,name:"outputShape",type:"number[]"},{start:2,name:"sparseValues",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",defaultValue:!1,notSupported:!0}]},{tfOpName:"TensorScatterUpdate",category:"slice_join",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"values",type:"tensor"}]}]});var gw={};Yt(gw,{json:()=>yet});var yet,qG=h(()=>{yet=[{tfOpName:"SparseFillEmptyRows",category:"sparse",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"denseShape",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}]},{tfOpName:"SparseReshape",category:"sparse",inputs:[{start:0,name:"inputIndices",type:"tensor"},{start:1,name:"inputShape",type:"tensor"},{start:2,name:"newShape",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SparseSegmentMean",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]},{tfOpName:"SparseSegmentSum",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]}]});var xw={};Yt(xw,{json:()=>bet});var bet,XG=h(()=>{bet=[{tfOpName:"FFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"RFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]},{tfOpName:"IRFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]}]});var yw={};Yt(yw,{json:()=>vet});var vet,jG=h(()=>{vet=[{tfOpName:"StaticRegexReplace",category:"string",inputs:[{start:0,name:"input",type:"tensor"}],attrs:[{tfName:"pattern",name:"pattern",type:"string"},{tfName:"rewrite",name:"rewrite",type:"string"},{tfName:"replace_global",name:"replaceGlobal",type:"bool"}]},{tfOpName:"StringNGrams",category:"string",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"dataSplits",type:"tensor"}],attrs:[{tfName:"separator",name:"separator",type:"string"},{tfName:"ngram_widths",name:"nGramWidths",type:"number[]"},{tfName:"left_pad",name:"leftPad",type:"string"},{tfName:"right_pad",name:"rightPad",type:"string"},{tfName:"pad_width",name:"padWidth",type:"number"},{tfName:"preserve_short_sequences",name:"preserveShortSequences",type:"bool"}],outputs:["ngrams","ngrams_splits"]},{tfOpName:"StringSplit",category:"string",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"delimiter",type:"tensor"}],attrs:[{tfName:"skip_empty",name:"skipEmpty",type:"bool"}],outputs:["indices","values","shape"]},{tfOpName:"StringToHashBucketFast",category:"string",inputs:[{start:0,name:"input",type:"tensor"}],attrs:[{tfName:"num_buckets",name:"numBuckets",type:"number"}]}]});var bw={};Yt(bw,{json:()=>wet});var wet,YG=h(()=>{wet=[{tfOpName:"Cast",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"SrcT",name:"sdtype",type:"dtype",notSupported:!0},{tfName:"DstT",name:"dtype",type:"dtype"}]},{tfOpName:"ExpandDims",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"MirrorPad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"mode",name:"mode",type:"string"}]},{tfOpName:"Pad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"constant_value",name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"PadV2",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"},{start:2,name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"Reshape",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}]},{tfOpName:"EnsureShape",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}]},{tfOpName:"Squeeze",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"axis",tfDeprecatedName:"squeeze_dims",name:"axis",type:"number[]"}]},{tfOpName:"SpaceToBatchND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"paddings",type:"number[]"}]},{tfOpName:"BatchToSpaceND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"crops",type:"number[]"}]},{tfOpName:"DepthToSpace",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"block_size",name:"blockSize",type:"number"},{tfName:"data_format",name:"dataFormat",type:"string"}]},{tfOpName:"BroadcastTo",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}],attrs:[]},{tfOpName:"BroadcastArgs",category:"transformation",inputs:[{start:0,name:"s0",type:"tensor"},{start:1,name:"s1",type:"tensor"}],attrs:[]}]});function Cet(r){let t=O().global;if(typeof t.atob!="undefined")return t.atob(r);if(typeof Buffer!="undefined")return new Buffer(r,"base64").toString();throw new Error("Unable to decode base64 in this environment. Missing built-in atob() or Buffer()")}function QG(r,t){let e=Array.isArray(r)?String.fromCharCode.apply(null,r):Cet(r);return t?e:e.toLowerCase()}function Ng(r,t,e,o=!1){let n=r[t];return n!=null?QG(n.s,o):e}function Tg(r,t,e){let o=r[t];return o?o.b:e}function Ig(r,t,e){let o=r[t]||{},n=o.i!=null?o.i:o.f!=null?o.f:e;return typeof n=="number"?n:parseInt(n,10)}function vw(r){switch(typeof r=="string"&&(r=Nr[r]),r){case Nr.DT_FLOAT:case Nr.DT_HALF:return"float32";case Nr.DT_INT32:case Nr.DT_INT64:case Nr.DT_INT8:case Nr.DT_UINT8:return"int32";case Nr.DT_BOOL:return"bool";case Nr.DT_DOUBLE:return"float32";case Nr.DT_STRING:return"string";case Nr.DT_COMPLEX64:case Nr.DT_COMPLEX128:return"complex64";default:return null}}function ZG(r,t,e){let o=r[t];return o&&o.func?o.func.name:e}function kg(r,t,e){let o=r[t];return o&&o.type?vw(o.type):e}function Eg(r,t,e){let o=r[t];return o&&o.list&&o.list.type?o.list.type.map(n=>vw(n)):e}function JG(r){if(!r.unknownRank)return r.dim!=null?r.dim.map(t=>typeof t.size=="number"?t.size:parseInt(t.size,10)):[]}function $g(r,t,e){let o=r[t];return o&&o.shape?JG(o.shape):e}function Rg(r,t,e){let o=r[t];return o?((o.list.f&&o.list.f.length?o.list.f:o.list.i)||[]).map(n=>typeof n=="number"?n:parseInt(n,10)):e}function Ag(r,t,e,o=!1){let n=r[t];return n&&n.list&&n.list.s?n.list.s.map(s=>QG(s,o)):e}function _g(r,t,e){let o=r[t];return o&&o.list&&o.list.shape?o.list.shape.map(n=>JG(n)):e}function Dg(r,t,e){let o=r[t];return o&&o.list&&o.list.b?o.list.b:e}var $p,ww=h(()=>{I();AG();Cg();xe();_G();DG();FG();OG();PG();LG();MG();BG();VG();zG();GG();WG();UG();HG();KG();qG();XG();jG();YG();$p=class{static get Instance(){return this._instance||(this._instance=new this)}constructor(){let t=[ew,rw,ow,nw,sw,aw,iw,cw,lw,uw,pw,mw,fw,dw,hw,gw,xw,yw,bw],e=[].concat(...t.map(o=>o.json));this.opMappers=e.reduce((o,n)=>(o[n.tfOpName]=n,o),{})}transformGraph(t,e={}){let o=t.node,n=[],s=[],a=[],i=o.reduce((x,g)=>(x[g.name]=this.mapNode(g),g.op.startsWith("Placeholder")?n.push(x[g.name]):g.op==="Const"?s.push(x[g.name]):(g.input==null||g.input.length===0)&&a.push(x[g.name]),x),{}),c=[],l=[],u={},p={};e!=null&&(u=this.mapSignatureEntries(e.inputs),p=this.mapSignatureEntries(e.outputs));let m=Object.keys(i);m.forEach(x=>{let g=i[x];g.inputNames.forEach((y,v)=>{let[N,,S]=ko(y),R=i[N];if(R.outputs!=null){let A=R.outputs.indexOf(S);if(A!==-1){let _=`${N}:${A}`;g.inputNames[v]=_}}g.inputs.push(R),R.children.push(g)})}),Object.keys(p).length===0?m.forEach(x=>{let g=i[x];g.children.length===0&&l.push(g)}):Object.keys(p).forEach(x=>{let[g]=ko(x),y=i[g];y!=null&&(y.signatureKey=p[x],l.push(y))}),Object.keys(u).length>0?Object.keys(u).forEach(x=>{let[g]=ko(x),y=i[g];y&&(y.signatureKey=u[x],c.push(y))}):c=n;let f={};t.library!=null&&t.library.function!=null&&(f=t.library.function.reduce((x,g)=>(x[g.signature.name]=this.mapFunction(g),x),{}));let d={nodes:i,inputs:c,outputs:l,weights:s,placeholders:n,signature:e,functions:f};return a.length>0&&(d.initNodes=a),d}mapSignatureEntries(t){return Object.keys(t||{}).reduce((e,o)=>(e[t[o].name]=o,e),{})}mapNode(t){let e=wg(t.op)||this.opMappers[t.op]||{};t.attr==null&&(t.attr={});let o={name:t.name,op:t.op,category:e.category,inputNames:(t.input||[]).map(n=>n.startsWith("^")?n.slice(1):n),inputs:[],children:[],inputParams:{},attrParams:{},rawAttrs:t.attr,outputs:e.outputs};return e.inputs!=null&&(o.inputParams=e.inputs.reduce((n,s)=>(n[s.name]={type:s.type,inputIndexStart:s.start,inputIndexEnd:s.end},n),{})),e.attrs!=null&&(o.attrParams=e.attrs.reduce((n,s)=>{let a=s.type,i;switch(s.type){case"string":i=Ng(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Ng(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"string[]":i=Ag(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Ag(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"number":i=Ig(t.attr,s.tfName,s.defaultValue||0),i===void 0&&s.tfDeprecatedName&&(i=Ig(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"number[]":i=Rg(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Rg(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"bool":i=Tg(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Tg(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"bool[]":i=Dg(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Dg(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"shape":i=$g(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=$g(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"shape[]":i=_g(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=_g(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"dtype":i=kg(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=kg(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"dtype[]":i=Eg(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=Eg(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"func":i=ZG(t.attr,s.tfName,s.defaultValue),i===void 0&&s.tfDeprecatedName&&(i=ZG(t.attr,s.tfDeprecatedName,s.defaultValue));break;case"tensor":case"tensors":break;default:throw new Error(`Unsupported param type: ${s.type} for op: ${t.op}`)}return n[s.name]={value:i,type:a},n},{})),o}mapFunction(t){let e=t.nodeDef,o=[],n=[],s={};e!=null&&(s=e.reduce((p,m)=>(p[m.name]=this.mapNode(m),m.op==="Const"&&n.push(p[m.name]),p),{}));let a=[],i=[];t.signature.inputArg.forEach(p=>{let[m]=ko(p.name),f={name:m,op:"Placeholder",inputs:[],inputNames:[],category:"graph",inputParams:{},attrParams:{dtype:{value:vw(p.type),type:"dtype"}},children:[]};f.signatureKey=p.name,a.push(f),s[m]=f}),Object.keys(s).forEach(p=>{let m=s[p];m.inputNames.forEach((f,d)=>{let[x,,g]=ko(f),y=s[x];if(y.outputs!=null){let v=y.outputs.indexOf(g);if(v!==-1){let N=`${x}:${v}`;m.inputNames[d]=N}}m.inputs.push(y),y.children.push(m)})});let l=t.ret;t.signature.outputArg.forEach(p=>{let[m,f]=ko(l[p.name]),d=s[m];d!=null&&(d.defaultOutput=f,i.push(d))});let u=this.mapArgsToSignature(t);return{nodes:s,inputs:a,outputs:i,weights:n,placeholders:o,signature:u}}mapArgsToSignature(t){return{methodName:t.signature.name,inputs:t.signature.inputArg.reduce((e,o)=>(e[o.name]=this.mapArgToTensorInfo(o),e),{}),outputs:t.signature.outputArg.reduce((e,o)=>(e[o.name]=this.mapArgToTensorInfo(o,t.ret),e),{})}}mapArgToTensorInfo(t,e){let o=t.name;return e!=null&&(o=e[o]),{name:o,dtype:t.type}}}});var Fg,tW=h(()=>{xe();ww();Fg=class{constructor(t,e,o){this.node=t,this.tensorMap=e,this.context=o,this.inputs=[],this.attrs={},this.inputs=t.inputNames.map(n=>this.getInput(n)),t.rawAttrs!=null&&(this.attrs=Object.keys(t.rawAttrs).reduce((n,s)=>(n[s]=this.getAttr(s),n),{}))}getInput(t){return Ce(t,this.tensorMap,this.context)}getAttr(t,e){let o=this.node.rawAttrs[t];if(o.tensor!=null)return Ce(t,this.tensorMap,this.context);if(o.i!=null||o.f!=null)return Ig(this.node.rawAttrs,t,e);if(o.s!=null)return Ng(this.node.rawAttrs,t,e);if(o.b!=null)return Tg(this.node.rawAttrs,t,e);if(o.shape!=null)return $g(this.node.rawAttrs,t,e);if(o.type!=null)return kg(this.node.rawAttrs,t,e);if(o.list!=null){if(o.list.i!=null||o.list.f!=null)return Rg(this.node.rawAttrs,t,e);if(o.list.s!=null)return Ag(this.node.rawAttrs,t,e);if(o.list.shape!=null)return _g(this.node.rawAttrs,t,e);if(o.list.b!=null)return Dg(this.node.rawAttrs,t,e);if(o.list.type!=null)return Eg(this.node.rawAttrs,t,e)}return e}}});var Lt={};Yt(Lt,{OP_SCOPE_SUFFIX:()=>Cx,abs:()=>Be,acos:()=>VC,acosh:()=>GC,add:()=>mt,addN:()=>UC,all:()=>KC,any:()=>XC,argMax:()=>YC,argMin:()=>QC,asin:()=>tS,asinh:()=>rS,atan:()=>nS,atan2:()=>aS,atanh:()=>cS,avgPool:()=>Sm,avgPool3d:()=>mS,basicLSTMCell:()=>dS,batchNorm:()=>zn,batchNorm2d:()=>yS,batchNorm3d:()=>vS,batchNorm4d:()=>CS,batchToSpaceND:()=>Nm,bincount:()=>Tm,bitwiseAnd:()=>NS,booleanMaskAsync:()=>b6,broadcastArgs:()=>IS,broadcastTo:()=>Gn,buffer:()=>ut,cast:()=>_t,ceil:()=>ES,clipByValue:()=>RS,clone:()=>dr,complex:()=>mr,concat:()=>Jt,concat1d:()=>_S,concat2d:()=>FS,concat3d:()=>PS,concat4d:()=>MS,conv1d:()=>VS,conv2d:()=>Wn,conv2dTranspose:()=>GS,conv3d:()=>US,conv3dTranspose:()=>XS,cos:()=>YS,cosh:()=>QS,cosineWindow:()=>Hu,cumprod:()=>tN,cumsum:()=>rN,denseBincount:()=>nN,depthToSpace:()=>aN,depthwiseConv2d:()=>al,diag:()=>cN,dilation2d:()=>uN,div:()=>Dt,divNoNan:()=>fN,dot:()=>hN,dropout:()=>A6,einsum:()=>Un,elu:()=>Rm,enclosingPowerOfTwo:()=>Dy,ensureShape:()=>xN,equal:()=>$m,erf:()=>bN,euclideanNorm:()=>SN,exp:()=>no,expandDims:()=>_r,expm1:()=>TN,eye:()=>Pm,fft:()=>dl,fill:()=>Lo,floor:()=>Lm,floorDiv:()=>vm,fused:()=>Fy,gather:()=>Mm,gatherND:()=>$6,greater:()=>Ta,greaterEqual:()=>Vm,ifft:()=>_a,imag:()=>Kn,image:()=>Lf,inTopKAsync:()=>D6,irfft:()=>vf,isFinite:()=>kN,isInf:()=>$N,isNaN:()=>AN,leakyRelu:()=>zm,less:()=>Ru,lessEqual:()=>pl,linalg:()=>OX,linspace:()=>DN,localResponseNormalization:()=>ON,log:()=>pn,log1p:()=>Um,logSigmoid:()=>MN,logSoftmax:()=>VN,logSumExp:()=>qm,logicalAnd:()=>Ia,logicalNot:()=>jm,logicalOr:()=>Ym,logicalXor:()=>GN,losses:()=>PX,lowerBound:()=>UN,matMul:()=>zt,max:()=>Bo,maxPool:()=>Jm,maxPool3d:()=>KN,maxPoolWithArgmax:()=>XN,maximum:()=>tf,mean:()=>ka,meshgrid:()=>YN,min:()=>Nu,minimum:()=>Ea,mirrorPad:()=>QN,mod:()=>tT,moments:()=>rT,movingAverage:()=>C6,mul:()=>tt,multiRNNCell:()=>nT,multinomial:()=>aT,neg:()=>Xe,norm:()=>Na,notEqual:()=>nf,oneHot:()=>cT,ones:()=>Vo,onesLike:()=>uT,op:()=>T,outerProduct:()=>mT,pad:()=>zo,pad1d:()=>dT,pad2d:()=>gT,pad3d:()=>yT,pad4d:()=>vT,pool:()=>CT,pow:()=>ln,prelu:()=>af,print:()=>bm,prod:()=>NT,raggedGather:()=>IT,raggedRange:()=>ET,raggedTensorToTensor:()=>RT,rand:()=>_T,randomGamma:()=>YT,randomNormal:()=>mf,randomStandardNormal:()=>QT,randomUniform:()=>fl,randomUniformInt:()=>t1,range:()=>Xn,real:()=>fn,reciprocal:()=>r1,relu:()=>jn,relu6:()=>hf,reshape:()=>z,reverse:()=>jr,reverse1d:()=>n1,reverse2d:()=>a1,reverse3d:()=>c1,reverse4d:()=>u1,rfft:()=>hl,round:()=>gf,rsqrt:()=>m1,scalar:()=>bt,scatterND:()=>N6,searchSorted:()=>Fu,selu:()=>d1,separableConv2d:()=>g1,setdiff1dAsync:()=>y1,sigmoid:()=>bo,sign:()=>v1,signal:()=>FX,sin:()=>C1,sinh:()=>N1,slice:()=>Ft,slice1d:()=>I1,slice2d:()=>E1,slice3d:()=>R1,slice4d:()=>_1,softmax:()=>F1,softplus:()=>Km,spaceToBatchND:()=>sf,sparse:()=>LX,sparseToDense:()=>k6,spectral:()=>DX,split:()=>dn,sqrt:()=>xr,square:()=>Ve,squaredDifference:()=>Cf,squeeze:()=>Da,stack:()=>cr,step:()=>Nf,stridedSlice:()=>P1,string:()=>MX,sub:()=>vt,sum:()=>Gt,tan:()=>M1,tanh:()=>xu,tensor:()=>ir,tensor1d:()=>ze,tensor2d:()=>hn,tensor3d:()=>If,tensor4d:()=>V1,tensor5d:()=>G1,tensor6d:()=>U1,tensorScatterUpdate:()=>X1,tile:()=>Hn,topk:()=>Y1,transpose:()=>Af,truncatedNormal:()=>Q1,unique:()=>tI,unsortedSegmentSum:()=>rI,unstack:()=>Yr,upperBound:()=>nI,variable:()=>aI,where:()=>qr,whereAsync:()=>Rf,zeros:()=>Xr,zerosLike:()=>ke});var Le=h(()=>{Xu();});var eW,rW=h(()=>{Le();xe();eW=(r,t,e,o=Lt)=>{switch(r.op){case"BiasAdd":case"AddV2":case"Add":return[o.add(w("a",r,t,e),w("b",r,t,e))];case"AddN":return[o.addN(w("tensors",r,t,e))];case"FloorMod":case"Mod":return[o.mod(w("a",r,t,e),w("b",r,t,e))];case"Mul":return[o.mul(w("a",r,t,e),w("b",r,t,e))];case"RealDiv":case"Div":return[o.div(w("a",r,t,e),w("b",r,t,e))];case"DivNoNan":return[o.divNoNan(w("a",r,t,e),w("b",r,t,e))];case"FloorDiv":return[o.floorDiv(w("a",r,t,e),w("b",r,t,e))];case"Sub":return[o.sub(w("a",r,t,e),w("b",r,t,e))];case"Minimum":return[o.minimum(w("a",r,t,e),w("b",r,t,e))];case"Maximum":return[o.maximum(w("a",r,t,e),w("b",r,t,e))];case"Pow":return[o.pow(w("a",r,t,e),w("b",r,t,e))];case"SquaredDifference":return[o.squaredDifference(w("a",r,t,e),w("b",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var oW,nW=h(()=>{Le();xe();oW=(r,t,e,o=Lt)=>{switch(r.op){case"Abs":case"ComplexAbs":return[o.abs(w("x",r,t,e))];case"Acos":return[o.acos(w("x",r,t,e))];case"Acosh":return[o.acosh(w("x",r,t,e))];case"Asin":return[o.asin(w("x",r,t,e))];case"Asinh":return[o.asinh(w("x",r,t,e))];case"Atan":return[o.atan(w("x",r,t,e))];case"Atan2":return[o.atan2(w("x",r,t,e),w("y",r,t,e))];case"Atanh":return[o.atanh(w("x",r,t,e))];case"Ceil":return[o.ceil(w("x",r,t,e))];case"Complex":return[o.complex(w("real",r,t,e),w("imag",r,t,e))];case"Cos":return[o.cos(w("x",r,t,e))];case"Cosh":return[o.cosh(w("x",r,t,e))];case"Elu":return[o.elu(w("x",r,t,e))];case"Erf":return[o.erf(w("x",r,t,e))];case"Exp":return[o.exp(w("x",r,t,e))];case"Expm1":return[o.expm1(w("x",r,t,e))];case"Floor":return[o.floor(w("x",r,t,e))];case"Log":return[o.log(w("x",r,t,e))];case"Log1p":return[o.log1p(w("x",r,t,e))];case"Imag":return[o.imag(w("x",r,t,e))];case"Neg":return[o.neg(w("x",r,t,e))];case"Reciprocal":return[o.reciprocal(w("x",r,t,e))];case"Real":return[o.real(w("x",r,t,e))];case"Relu":return[o.relu(w("x",r,t,e))];case"Round":return[o.round(w("x",r,t,e))];case"Selu":return[o.selu(w("x",r,t,e))];case"Sigmoid":return[o.sigmoid(w("x",r,t,e))];case"Sin":return[o.sin(w("x",r,t,e))];case"Sign":return[o.sign(w("x",r,t,e))];case"Sinh":return[o.sinh(w("x",r,t,e))];case"Softplus":return[o.softplus(w("x",r,t,e))];case"Sqrt":return[o.sqrt(w("x",r,t,e))];case"Square":return[o.square(w("x",r,t,e))];case"Tanh":return[o.tanh(w("x",r,t,e))];case"Tan":return[o.tan(w("x",r,t,e))];case"ClipByValue":return[o.clipByValue(w("x",r,t,e),w("clipValueMin",r,t,e),w("clipValueMax",r,t,e))];case"Relu6":return[o.relu6(w("x",r,t,e))];case"Rsqrt":return[o.rsqrt(Ce(r.inputNames[0],t,e))];case"LeakyRelu":return[o.leakyRelu(w("x",r,t,e),w("alpha",r,t,e))];case"Prelu":return[o.prelu(w("x",r,t,e),w("alpha",r,t,e))];case"IsNan":return[o.isNaN(Ce(r.inputNames[0],t,e))];case"IsInf":return[o.isInf(Ce(r.inputNames[0],t,e))];case"IsFinite":return[o.isFinite(Ce(r.inputNames[0],t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});function zr(r,t,e=""){if(!(typeof r=="number"||typeof t=="number")){b.assert(r.length===t.length,()=>e+` Shapes ${r} and ${t} must match`);for(let o=0;o<r.length;o++){let n=r[o],s=t[o];b.assert(n<0||s<0||n===s,()=>e+` Shapes ${r} and ${t} must match`)}}}function sW(r){return!(typeof r=="number"||r.some(t=>t<0))}function Xl(r,t,e){let o=Og(r,e),n=!sW(o);if(n&&t.length===0)throw new Error(`Tried to calculate elements of an empty list with non-fully-defined elementShape: ${o}`);if(n&&t.forEach(s=>{o=Og(s.shape,o)}),!sW(o))throw new Error(`Non-fully-defined elementShape: ${o}`);return o}function Og(r,t){if(typeof r=="number")return t;if(typeof t=="number")return r;if(r.length!==t.length)throw new Error(`Incompatible ranks during merge: ${r} vs. ${t}`);let e=[];for(let o=0;o<r.length;++o){let n=r[o],s=t[o];if(n>=0&&s>=0&&n!==s)throw new Error(`Incompatible shape during merge: ${r} vs. ${t}`);e[o]=n>=0?n:s}return e}var Cw=h(()=>{I();});var Pg,aW=h(()=>{I();Cw();Pg=class{constructor(t,e,o,n,s,a,i){this.name=t,this.dtype=e,this.maxSize=o,this.elementShape=n,this.identicalElementShapes=s,this.dynamicSize=a,this.clearAfterRead=i,this.tensors=[],this.closed_=!1,this.idTensor=bt(0),fr(this.idTensor)}get id(){return this.idTensor.id}get closed(){return this.closed_}clearAndClose(t){this.tensors.forEach(e=>{(t==null||!t.has(e.tensor.id))&&e.tensor.dispose()}),this.tensors=[],this.closed_=!0,this.idTensor.dispose()}size(){return this.tensors.length}read(t){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(t<0||t>=this.size())throw new Error(`Tried to read from index ${t}, but array size is: ${this.size()}`);let e=this.tensors[t];if(e.cleared)throw new Error(`TensorArray ${this.name}: Could not read index ${t} twice because it was cleared after a previous read (perhaps try setting clear_after_read = false?).`);return this.clearAfterRead&&(e.cleared=!0),e.read=!0,e.tensor}readMany(t){return t.map(e=>this.read(e))}write(t,e){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(t<0||!this.dynamicSize&&t>=this.maxSize)throw new Error(`Tried to write to index ${t}, but array is not resizeable and size is: ${this.maxSize}`);let o=this.tensors[t]||{};if(e.dtype!==this.dtype)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t},
          because the value dtype is ${e.dtype}, but TensorArray dtype is ${this.dtype}.`);if(this.size()===0&&(this.elementShape==null||this.elementShape.length===0)&&(this.elementShape=e.shape),zr(this.elementShape,e.shape,`TensorArray ${this.name}: Could not write to TensorArray index ${t}.`),o.read)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t}, because it has already been read.`);if(o.written)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t}, because it has already been written.`);o.tensor=e,fr(e),o.written=!0,this.tensors[t]=o}writeMany(t,e){if(t.length!==e.length)throw new Error(`TensorArray ${this.name}: could not write multiple tensors,because the index size: ${t.length} is not the same as tensors size: ${e.length}.`);t.forEach((o,n)=>this.write(o,e[n]))}gather(t,e){if(e&&e!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but gather requested dtype ${e}`);if(t)t=t.slice(0,this.size());else{t=[];for(let n=0;n<this.size();n++)t.push(n)}if(t.length===0)return ir([],[0].concat(this.elementShape));let o=this.readMany(t);return zr(this.elementShape,o[0].shape,"TensorArray shape mismatch: "),cr(o,0)}concat(t){if(t&&t!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but concat requested dtype ${t}`);if(this.size()===0)return ir([],[0].concat(this.elementShape));let e=[];for(let n=0;n<this.size();n++)e.push(n);let o=this.readMany(e);return zr(this.elementShape,o[0].shape,`TensorArray shape mismatch: tensor array shape (${this.elementShape}) vs first tensor shape (${o[0].shape})`),Jt(o,0)}scatter(t,e){if(e.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${e.dtype}`);if(t.length!==e.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${t.length} vs. ${e.shape[0]}`);let o=Math.max(...t);if(!this.dynamicSize&&o>=this.maxSize)throw new Error(`Max index must be < array size (${o}  vs. ${this.maxSize})`);this.writeMany(t,Yr(e,0))}split(t,e){if(e.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${e.dtype}`);let o=0,n=t.map(c=>(o+=c,o));if(o!==e.shape[0])throw new Error(`Expected sum of lengths to be equal to
          tensor.shape[0], but sum of lengths is
        ${o}, and tensor's shape is: ${e.shape}`);if(!this.dynamicSize&&t.length!==this.maxSize)throw new Error(`TensorArray's size is not equal to the size of lengths (${this.maxSize} vs. ${t.length}), and the TensorArray is not marked as dynamically resizeable`);let s=o===0?0:e.size/o,a=[];Tt(()=>{e=z(e,[1,o,s]);for(let c=0;c<t.length;++c){let u=[0,c===0?0:n[c-1],0],p=[1,t[c],s];a[c]=z(Ft(e,u,p),this.elementShape)}return a});let i=[];for(let c=0;c<t.length;c++)i[c]=c;this.writeMany(i,a)}}});function iW(r,t,e){let o=r.dtype;if(r.shape.length<1)throw new Error(`Tensor must be at least a vector, but saw shape: ${r.shape}`);if(r.dtype!==e)throw new Error(`Invalid data types; op elements ${r.dtype}, but list elements ${e}`);let n=r.shape.slice(1);zr(n,t,"TensorList shape mismatch: ");let s=Yr(r);return new jl(s,t,o)}function cW(r,t,e,o){return new jl([],r,t,o)}function lW(r,t,e,o){if(t.length!==r.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${t.length} vs. ${r.shape[0]}`);let n=Math.max(...t);if(o!=null&&o!==-1&&n>=o)throw new Error(`Max index must be < array size (${n}  vs. ${o})`);let s=new jl([],e,r.dtype,o),a=Yr(r,0);return t.forEach((i,c)=>{s.setItem(i,a[c])}),s}function uW(r,t,e){let o=0,n=t.map(u=>(o+=u,o));if(o!==r.shape[0])throw new Error(`Expected sum of lengths to be equal to
          tensor.shape[0], but sum of lengths is
        ${o}, and tensor's shape is: ${r.shape}`);let s=r.shape.slice(1),a=Og(s,e),i=o===0?0:r.size/o,c=Tt(()=>{let u=[];r=z(r,[1,o,i]);for(let p=0;p<t.length;++p){let f=[0,p===0?0:n[p-1],0],d=[1,t[p],i];u[p]=z(Ft(r,f,d),a)}return r.dispose(),u}),l=new jl([],e,r.dtype,t.length);for(let u=0;u<c.length;u++)l.setItem(u,c[u]);return l}var jl,pW=h(()=>{I();Cw();jl=class r{get id(){return this.idTensor.id}constructor(t,e,o,n=-1){this.tensors=t,this.elementShape=e,this.elementDtype=o,t!=null&&t.forEach(s=>{if(o!==s.dtype)throw new Error(`Invalid data types; op elements ${o}, but list elements ${s.dtype}`);zr(e,s.shape,"TensorList shape mismatch: "),fr(s)}),this.idTensor=bt(0),this.maxNumElements=n,fr(this.idTensor)}copy(){return new r([...this.tensors],this.elementShape,this.elementDtype)}clearAndClose(t){this.tensors.forEach(e=>{(t==null||!t.has(e.id))&&e.dispose()}),this.tensors.length=0,this.idTensor.dispose()}size(){return this.tensors.length}stack(t,e,o=-1){if(e!==this.elementDtype)throw new Error(`Invalid data types; op elements ${e}, but list elements ${this.elementDtype}`);if(o!==-1&&this.tensors.length!==o)throw new Error(`Operation expected a list with ${o} elements but got a list with ${this.tensors.length} elements.`);zr(t,this.elementShape,"TensorList shape mismatch: ");let n=Xl(this.elementShape,this.tensors,t);return Tt(()=>{let s=this.tensors.map(a=>z(a,n));return cr(s,0)})}popBack(t,e){if(e!==this.elementDtype)throw new Error(`Invalid data types; op elements ${e}, but list elements ${this.elementDtype}`);if(this.size()===0)throw new Error("Trying to pop from an empty list.");let o=Xl(this.elementShape,this.tensors,t),n=this.tensors.pop();return n.kept=!1,zr(n.shape,t,"TensorList shape mismatch: "),z(n,o)}pushBack(t){if(t.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t.dtype}, but list elements ${this.elementDtype}`);if(zr(t.shape,this.elementShape,"TensorList shape mismatch: "),this.maxNumElements===this.size())throw new Error("Trying to push element into a full list.");fr(t),this.tensors.push(t)}resize(t){if(t<0)throw new Error(`TensorListResize expects size to be non-negative. Got: ${t}`);if(this.maxNumElements!==-1&&t>this.maxNumElements)throw new Error(`TensorListResize input size ${t} is greater maxNumElement ${this.maxNumElements}.`);let e=new r([],this.elementShape,this.elementDtype,this.maxNumElements);e.tensors.length=t;for(let o=0;o<Math.min(this.tensors.length,t);++o)e.tensors[o]=this.tensors[o];return e}getItem(t,e,o){if(o!==this.elementDtype)throw new Error(`Invalid data types; op elements ${o}, but list elements ${this.elementDtype}`);if(t<0||t>this.tensors.length)throw new Error(`Trying to access element ${t} in a list with ${this.tensors.length} elements.`);if(this.tensors[t]==null)throw new Error(`element at index ${t} is null.`);zr(this.tensors[t].shape,e,"TensorList shape mismatch: ");let n=Xl(this.elementShape,this.tensors,e);return z(this.tensors[t],n)}setItem(t,e){if(e.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${e.dtype}, but list elements ${this.elementDtype}`);if(t<0||this.maxNumElements!==-1&&t>=this.maxNumElements)throw new Error(`Trying to set element ${t} in a list with max ${this.maxNumElements} elements.`);zr(this.elementShape,e.shape,"TensorList shape mismatch: "),fr(e),this.tensors[t]!=null&&(this.tensors[t].kept=!1),this.tensors[t]=e}gather(t,e,o){if(e!==this.elementDtype)throw new Error(`Invalid data types; op elements ${e}, but list elements ${this.elementDtype}`);zr(this.elementShape,o,"TensorList shape mismatch: "),t=t.slice(0,this.size());let n=Xl(this.elementShape,this.tensors,o);return t.length===0?ir([],[0].concat(n)):Tt(()=>{let s=t.map(a=>z(this.tensors[a],n));return cr(s,0)})}concat(t,e){if(t&&t!==this.elementDtype)throw new Error(`TensorList dtype is ${this.elementDtype} but concat requested dtype ${t}`);zr(this.elementShape,e,"TensorList shape mismatch: ");let o=Xl(this.elementShape,this.tensors,e);return this.size()===0?ir([],[0].concat(o)):Tt(()=>{let n=this.tensors.map(s=>z(s,o));return Jt(n,0)})}}});var mW,fW=h(()=>{I();aW();pW();xe();mW=async(r,t,e)=>{switch(r.op){case"If":case"StatelessIf":{let o=w("thenBranch",r,t,e),n=w("elseBranch",r,t,e),s=w("cond",r,t,e),a=w("args",r,t,e);return(await s.data())[0]?e.functionMap[o].executeFunctionAsync(a,e.tensorArrayMap,e.tensorListMap):e.functionMap[n].executeFunctionAsync(a,e.tensorArrayMap,e.tensorListMap)}case"While":case"StatelessWhile":{let o=w("body",r,t,e),n=w("cond",r,t,e),s=w("args",r,t,e),a=await e.functionMap[n].executeFunctionAsync(s,e.tensorArrayMap,e.tensorListMap),i=s.map(u=>u.id),c=await a[0].data();a.forEach(u=>{!u.kept&&i.indexOf(u.id)===-1&&u.dispose()});let l=s;for(;c[0];){let u=l;l=await e.functionMap[o].executeFunctionAsync(l,e.tensorArrayMap,e.tensorListMap);let p=l.map(f=>f.id);u.forEach(f=>{!f.kept&&i.indexOf(f.id)===-1&&p.indexOf(f.id)===-1&&f.dispose()});let m=await e.functionMap[n].executeFunctionAsync(l,e.tensorArrayMap,e.tensorListMap);c=await m[0].data(),m.forEach(f=>{!f.kept&&i.indexOf(f.id)===-1&&p.indexOf(f.id)===-1&&f.dispose()})}return l}case"LoopCond":{let o=w("pred",r,t,e);return[Eo(o)]}case"Switch":{let o=w("pred",r,t,e),n=w("data",r,t,e);return n.kept||(n=Eo(n)),(await o.data())[0]?[void 0,n]:[n,void 0]}case"Merge":{let o=r.inputNames.find(n=>Ce(n,t,e)!==void 0);if(o){let n=Ce(o,t,e);return[Eo(n)]}return}case"Enter":{let o=w("frameName",r,t,e),n=w("tensor",r,t,e);return e.enterFrame(o),[Eo(n)]}case"Exit":{let o=w("tensor",r,t,e);return e.exitFrame(),[Eo(o)]}case"NextIteration":{let o=w("tensor",r,t,e);return e.nextIteration(),[Eo(o)]}case"TensorArrayV3":{let o=w("size",r,t,e),n=w("dtype",r,t,e),s=w("elementShape",r,t,e),a=w("dynamicSize",r,t,e),i=w("clearAfterRead",r,t,e),c=w("identicalElementShapes",r,t,e),l=w("name",r,t,e),u=new Pg(l,n,o,s,c,a,i);return e.addTensorArray(u),[u.idTensor,bt(1)]}case"TensorArrayWriteV3":{let o=w("tensorArrayId",r,t,e),n=w("index",r,t,e),s=w("tensor",r,t,e),a=e.getTensorArray(o.id);return a.write(n,s),[a.idTensor]}case"TensorArrayReadV3":{let o=w("tensorArrayId",r,t,e),n=w("index",r,t,e);return[e.getTensorArray(o.id).read(n)]}case"TensorArrayGatherV3":{let o=w("tensorArrayId",r,t,e),n=w("indices",r,t,e),s=w("dtype",r,t,e);return[e.getTensorArray(o.id).gather(n,s)]}case"TensorArrayScatterV3":{let o=w("tensorArrayId",r,t,e),n=w("indices",r,t,e),s=w("tensor",r,t,e),a=e.getTensorArray(o.id);return a.scatter(n,s),[a.idTensor]}case"TensorArrayConcatV3":{let o=w("tensorArrayId",r,t,e),n=e.getTensorArray(o.id),s=w("dtype",r,t,e);return[n.concat(s)]}case"TensorArraySplitV3":{let o=w("tensorArrayId",r,t,e),n=w("tensor",r,t,e),s=w("lengths",r,t,e),a=e.getTensorArray(o.id);return a.split(s,n),[a.idTensor]}case"TensorArraySizeV3":{let o=w("tensorArrayId",r,t,e),n=e.getTensorArray(o.id);return[bt(n.size(),"int32")]}case"TensorArrayCloseV3":{let o=w("tensorArrayId",r,t,e),n=e.getTensorArray(o.id);return n.clearAndClose(),[n.idTensor]}case"TensorListSetItem":{let o=w("tensorListId",r,t,e),n=w("index",r,t,e),s=w("tensor",r,t,e),a=e.getTensorList(o.id);return a.setItem(n,s),[a.idTensor]}case"TensorListGetItem":{let o=w("tensorListId",r,t,e),n=w("index",r,t,e),s=w("elementShape",r,t,e),a=w("elementDType",r,t,e);return[e.getTensorList(o.id).getItem(n,s,a)]}case"TensorListScatterV2":case"TensorListScatter":{let o=w("indices",r,t,e),n=w("tensor",r,t,e),s=w("elementShape",r,t,e),a=w("numElements",r,t,e),i=lW(n,o,s,a);return e.addTensorList(i),[i.idTensor]}case"TensorListReserve":case"EmptyTensorList":{let o=w("elementShape",r,t,e),n=w("elementDType",r,t,e),s;r.op==="TensorListReserve"?s="numElements":s="maxNumElements";let a=w(s,r,t,e),i=r.op==="TensorListReserve"?-1:a,c=cW(o,n,a,i);return e.addTensorList(c),[c.idTensor]}case"TensorListGather":{let o=w("tensorListId",r,t,e),n=w("indices",r,t,e),s=w("elementShape",r,t,e),a=w("elementDType",r,t,e);return[e.getTensorList(o.id).gather(n,a,s)]}case"TensorListStack":{let o=w("tensorListId",r,t,e),n=w("elementShape",r,t,e),s=w("elementDType",r,t,e),a=w("numElements",r,t,e);return[e.getTensorList(o.id).stack(n,s,a)]}case"TensorListFromTensor":{let o=w("tensor",r,t,e),n=w("elementShape",r,t,e),s=w("elementDType",r,t,e),a=iW(o,n,s);return e.addTensorList(a),[a.idTensor]}case"TensorListConcat":case"TensorListConcatV2":{let o=w("tensorListId",r,t,e),n=e.getTensorList(o.id),s=w("dtype",r,t,e),a=w("elementShape",r,t,e);return[n.concat(s,a)]}case"TensorListPushBack":{let o=w("tensorListId",r,t,e),n=w("tensor",r,t,e),s=e.getTensorList(o.id);return s.pushBack(n),[s.idTensor]}case"TensorListPopBack":{let o=w("tensorListId",r,t,e),n=w("elementShape",r,t,e),s=w("elementDType",r,t,e);return[e.getTensorList(o.id).popBack(n,s)]}case"TensorListSplit":{let o=w("tensor",r,t,e),n=w("elementShape",r,t,e),s=w("lengths",r,t,e),a=uW(o,s,n);return e.addTensorList(a),[a.idTensor]}case"TensorListLength":{let o=w("tensorListId",r,t,e),n=e.getTensorList(o.id);return[bt(n.size(),"int32")]}case"TensorListResize":{let o=w("tensorListId",r,t,e),n=w("size",r,t,e),a=e.getTensorList(o.id).resize(n);return e.addTensorList(a),[a.idTensor]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});function dW(r,t,e){let[o,n]=w("fusedOps",r,t,e),s=o==="biasadd",a=!s,i=n==="prelu",c=o==="fusedbatchnorm",l=w("numArgs",r,t,e);if(s){if(i&&l!==2)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&s&&l!==1)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd must have one extra argument: bias.")}if(c)throw new Error("FusedConv2d and DepthwiseConv2d with FusedBatchNorm is not supported");let u=w("strides",r,t,e),p=Ep(r,t,e),m=w("dataFormat",r,t,e).toUpperCase(),f=w("dilations",r,t,e),[d,x]=w("args",r,t,e);a&&(x=d,d=void 0);let g=w("leakyreluAlpha",r,t,e);return{stride:u,pad:p,dataFormat:m,dilations:f,biasArg:d,preluArg:x,activationFunc:n,leakyreluAlpha:g}}var hW,gW=h(()=>{Le();xe();hW=(r,t,e,o=Lt)=>{switch(r.op){case"Conv1D":{let n=w("stride",r,t,e),s=w("pad",r,t,e),a=w("dataFormat",r,t,e).toUpperCase(),i=w("dilation",r,t,e);return[o.conv1d(w("x",r,t,e),w("filter",r,t,e),n,s,a,i)]}case"Conv2D":{let n=w("strides",r,t,e),s=Ep(r,t,e),a=w("dataFormat",r,t,e).toUpperCase(),i=w("dilations",r,t,e);return[o.conv2d(w("x",r,t,e),w("filter",r,t,e),[n[1],n[2]],s,a,[i[1],i[2]])]}case"_FusedConv2D":{let{stride:n,pad:s,dataFormat:a,dilations:i,biasArg:c,preluArg:l,activationFunc:u,leakyreluAlpha:p}=dW(r,t,e);return[o.fused.conv2d({x:w("x",r,t,e),filter:w("filter",r,t,e),strides:[n[1],n[2]],pad:s,dataFormat:a,dilations:[i[1],i[2]],bias:c,activation:u,preluActivationWeights:l,leakyreluAlpha:p})]}case"FusedDepthwiseConv2dNative":{let{stride:n,pad:s,dataFormat:a,dilations:i,biasArg:c,preluArg:l,activationFunc:u,leakyreluAlpha:p}=dW(r,t,e);return[o.fused.depthwiseConv2d({x:w("x",r,t,e),filter:w("filter",r,t,e),strides:[n[1],n[2]],pad:s,dataFormat:a,dilations:[i[1],i[2]],bias:c,activation:u,preluActivationWeights:l,leakyreluAlpha:p})]}case"Conv2DBackpropInput":case"Conv2dTranspose":{let n=w("outputShape",r,t,e),s=w("strides",r,t,e),a=Ep(r,t,e);return[o.conv2dTranspose(w("x",r,t,e),w("filter",r,t,e),n,[s[1],s[2]],a)]}case"DepthwiseConv2dNative":case"DepthwiseConv2d":{let n=w("strides",r,t,e),s=Ep(r,t,e),a=w("dilations",r,t,e),i=w("dataFormat",r,t,e).toUpperCase();return[o.depthwiseConv2d(w("input",r,t,e),w("filter",r,t,e),[n[1],n[2]],s,i,[a[1],a[2]])]}case"Conv3D":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("dataFormat",r,t,e).toUpperCase(),i=w("dilations",r,t,e);return[o.conv3d(w("x",r,t,e),w("filter",r,t,e),[n[1],n[2],n[3]],s,a,[i[1],i[2],i[3]])]}case"AvgPool":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("kernelSize",r,t,e);return[o.avgPool(w("x",r,t,e),[a[1],a[2]],[n[1],n[2]],s)]}case"MaxPool":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("kernelSize",r,t,e);return[o.maxPool(w("x",r,t,e),[a[1],a[2]],[n[1],n[2]],s)]}case"MaxPoolWithArgmax":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("kernelSize",r,t,e),i=w("includeBatchInIndex",r,t,e),{result:c,indexes:l}=o.maxPoolWithArgmax(w("x",r,t,e),[a[1],a[2]],[n[1],n[2]],s,i);return[c,l]}case"AvgPool3D":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("kernelSize",r,t,e);return[o.avgPool3d(w("x",r,t,e),[a[1],a[2],a[3]],[n[1],n[2],n[3]],s)]}case"MaxPool3D":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("kernelSize",r,t,e);return[o.maxPool3d(w("x",r,t,e),[a[1],a[2],a[3]],[n[1],n[2],n[3]],s)]}case"Dilation2D":{let n=w("strides",r,t,e),s=w("pad",r,t,e),a=w("dilations",r,t,e),i=n[1],c=n[2],l=a[1],u=a[2];return[o.dilation2d(w("x",r,t,e),w("filter",r,t,e),[i,c],s,[l,u],"NHWC")]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var xW,yW=h(()=>{Le();xe();xW=(r,t,e,o=Lt)=>{switch(r.op){case"Fill":{let n=w("shape",r,t,e),s=w("dtype",r,t,e),a=w("value",r,t,e);return[o.fill(n,a,s)]}case"LinSpace":{let n=w("start",r,t,e),s=w("stop",r,t,e),a=w("num",r,t,e);return[o.linspace(n,s,a)]}case"Multinomial":{let n=w("logits",r,t,e),s=w("numSamples",r,t,e),a=w("seed",r,t,e);return[o.multinomial(n,s,a)]}case"OneHot":{let n=w("indices",r,t,e),s=w("depth",r,t,e),a=w("onValue",r,t,e),i=w("offValue",r,t,e),c=w("dtype",r,t,e);return[o.oneHot(n,s,a,i,c)]}case"Ones":return[o.ones(w("shape",r,t,e),w("dtype",r,t,e))];case"OnesLike":return[o.onesLike(w("x",r,t,e))];case"RandomStandardNormal":return[o.randomStandardNormal(w("shape",r,t,e),w("dtype",r,t,e),w("seed",r,t,e))];case"RandomUniform":return[o.randomUniform(w("shape",r,t,e),w("minval",r,t,e),w("maxval",r,t,e),w("dtype",r,t,e))];case"RandomUniformInt":return[o.randomUniformInt(w("shape",r,t,e),w("minval",r,t,e),w("maxval",r,t,e),w("seed",r,t,e))];case"Range":{let n=w("start",r,t,e),s=w("stop",r,t,e),a=w("step",r,t,e);return[o.range(n,s,a,w("dtype",r,t,e))]}case"TruncatedNormal":{let n=w("shape",r,t,e),s=w("mean",r,t,e),a=w("stdDev",r,t,e),i=w("seed",r,t,e);return[o.truncatedNormal(n,s,a,w("dtype",r,t,e),i)]}case"Zeros":return[o.zeros(w("shape",r,t,e),w("dtype",r,t,e))];case"ZerosLike":return[o.zerosLike(w("x",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});function Sw(r,t,e){let o=w("boxes",r,t,e),n=w("scores",r,t,e),s=w("maxOutputSize",r,t,e),a=w("iouThreshold",r,t,e),i=w("scoreThreshold",r,t,e),c=w("softNmsSigma",r,t,e);return{boxes:o,scores:n,maxOutputSize:s,iouThreshold:a,scoreThreshold:i,softNmsSigma:c}}var bW,vW=h(()=>{Le();xe();bW=async(r,t,e,o,n=Lt)=>{switch(r.op){case"NonMaxSuppressionV5":{let{boxes:s,scores:a,maxOutputSize:i,iouThreshold:c,scoreThreshold:l,softNmsSigma:u}=Sw(r,t,e),p=await n.image.nonMaxSuppressionWithScoreAsync(s,a,i,c,l,u);return[p.selectedIndices,p.selectedScores]}case"NonMaxSuppressionV4":{let{boxes:s,scores:a,maxOutputSize:i,iouThreshold:c,scoreThreshold:l}=Sw(r,t,e),u=w("padToMaxOutputSize",r,t,e),p=await n.image.nonMaxSuppressionPaddedAsync(s,a,i,c,l,u);return[p.selectedIndices,p.validOutputs]}case"NonMaxSuppressionV3":case"NonMaxSuppressionV2":{let{boxes:s,scores:a,maxOutputSize:i,iouThreshold:c,scoreThreshold:l}=Sw(r,t,e);return[await n.image.nonMaxSuppressionAsync(s,a,i,c,l)]}case"Where":{let s=n.cast(w("condition",r,t,e),"bool"),a=[await n.whereAsync(s)];return s.dispose(),a}case"ListDiff":return n.setdiff1dAsync(w("x",r,t,e),w("y",r,t,e));default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var wW,CW=h(()=>{Le();xe();wW=(r,t,e,o=Lt)=>{switch(r.op){case"LowerBound":{let n=w("sortedSequence",r,t,e),s=w("values",r,t,e);return[o.lowerBound(n,s)]}case"TopKV2":{let n=w("x",r,t,e),s=w("k",r,t,e),a=w("sorted",r,t,e),i=o.topk(n,s,a);return[i.values,i.indices]}case"UpperBound":{let n=w("sortedSequence",r,t,e),s=w("values",r,t,e);return[o.upperBound(n,s)]}case"Unique":{let n=w("x",r,t,e),s=o.unique(n);return[s.values,s.indices]}case"UniqueV2":{let n=w("x",r,t,e),s=w("axis",r,t,e),a=o.unique(n,s);return[a.values,a.indices]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var SW,NW=h(()=>{Le();xe();SW=(r,t,e,o=Lt)=>{switch(r.op){case"Const":return t[r.name];case"PlaceholderWithDefault":let n=w("default",r,t,e);return[Ce(r.name,t,e)||n];case"Placeholder":return[Ce(r.name,t,e)];case"Identity":case"StopGradient":case"FakeQuantWithMinMaxVars":{let u=w("x",r,t,e);return[Eo(u)]}case"IdentityN":return w("x",r,t,e).map(u=>Eo(u));case"Snapshot":let s=w("x",r,t,e);return[Eo(s)];case"Shape":return[o.tensor1d(w("x",r,t,e).shape,"int32")];case"ShapeN":return w("x",r,t,e).map(u=>o.tensor1d(u.shape));case"Size":return[o.scalar(w("x",r,t,e).size,"int32")];case"Rank":return[o.scalar(w("x",r,t,e).rank,"int32")];case"NoOp":return[o.scalar(1)];case"Print":let a=w("x",r,t,e),i=w("data",r,t,e),c=w("message",r,t,e),l=w("summarize",r,t,e);console.warn("The graph has a tf.print() operation,usually used for debugging, which slows down performance."),console.log(c);for(let u=0;u<i.length;u++)console.log(Array.prototype.slice.call(i[u].dataSync()).slice(0,l));return[a];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var Lg,TW=h(()=>{I();Le();Lg=class{get id(){return this.handle.id}constructor(t,e){this.keyDType=t,this.valueDType=e,this.handle=bt(0),this.tensorMap=new Map,fr(this.handle)}clearAndClose(){this.tensorMap.forEach(t=>t.dispose()),this.tensorMap.clear(),this.handle.dispose()}size(){return this.tensorMap.size}tensorSize(){return bt(this.size(),"int32")}async import(t,e){this.checkKeyAndValueTensor(t,e);let o=await t.data();return this.tensorMap.forEach(n=>n.dispose()),this.tensorMap.clear(),Tt(()=>{let n=Yr(e),s=o.length,a=n.length;b.assert(s===a,()=>`The number of elements doesn't match, keys has ${s} elements, the values has ${a} elements.`);for(let i=0;i<s;i++){let c=o[i],l=n[i];fr(l),this.tensorMap.set(c,l)}return this.handle})}async find(t,e){this.checkKeyAndValueTensor(t,e);let o=await t.data();return Tt(()=>{let n=[];for(let s=0;s<o.length;s++){let a=o[s],i=this.findWithDefault(a,e);n.push(i)}return cr(n)})}findWithDefault(t,e){let o=this.tensorMap.get(t);return o!=null?o:e}checkKeyAndValueTensor(t,e){if(t.dtype!==this.keyDType)throw new Error(`Expect key dtype ${this.keyDType}, but got ${t.dtype}`);if(e.dtype!==this.valueDType)throw new Error(`Expect value dtype ${this.valueDType}, but got ${e.dtype}`)}}});var IW,kW=h(()=>{TW();xe();IW=async(r,t,e,o)=>{switch(r.op){case"HashTable":case"HashTableV2":{let n=o.getHashTableHandleByName(r.name);if(n!=null)return[n];{let s=w("keyDType",r,t,e),a=w("valueDType",r,t,e),i=new Lg(s,a);return o.addHashTable(r.name,i),[i.handle]}}case"InitializeTable":case"InitializeTableV2":case"LookupTableImport":case"LookupTableImportV2":{let n=w("tableHandle",r,t,e,o),s=w("keys",r,t,e),a=w("values",r,t,e);return[await o.getHashTableById(n.id).import(s,a)]}case"LookupTableFind":case"LookupTableFindV2":{let n=w("tableHandle",r,t,e,o),s=w("keys",r,t,e),a=w("defaultValue",r,t,e);return[await o.getHashTableById(n.id).find(s,a)]}case"LookupTableSize":case"LookupTableSizeV2":{let n=w("tableHandle",r,t,e,o);return[o.getHashTableById(n.id).tensorSize()]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var EW,$W=h(()=>{Le();xe();EW=(r,t,e,o=Lt)=>{switch(r.op){case"ResizeBilinear":{let n=w("images",r,t,e),s=w("size",r,t,e),a=w("alignCorners",r,t,e),i=w("halfPixelCenters",r,t,e);return[o.image.resizeBilinear(n,[s[0],s[1]],a,i)]}case"ResizeNearestNeighbor":{let n=w("images",r,t,e),s=w("size",r,t,e),a=w("alignCorners",r,t,e),i=w("halfPixelCenters",r,t,e);return[o.image.resizeNearestNeighbor(n,[s[0],s[1]],a,i)]}case"CropAndResize":{let n=w("image",r,t,e),s=w("boxes",r,t,e),a=w("boxInd",r,t,e),i=w("cropSize",r,t,e),c=w("method",r,t,e),l=w("extrapolationValue",r,t,e);return[o.image.cropAndResize(n,s,a,i,c,l)]}case"ImageProjectiveTransformV3":{let n=w("images",r,t,e),s=w("transforms",r,t,e),a=w("outputShape",r,t,e),i=w("fillValue",r,t,e),c=w("interpolation",r,t,e),l=w("fillMode",r,t,e);return[o.image.transform(n,s,c.toLowerCase(),l.toLowerCase(),i,a)]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var RW,AW=h(()=>{Le();xe();RW=(r,t,e,o=Lt)=>{switch(r.op){case"Equal":return[o.equal(w("a",r,t,e),w("b",r,t,e))];case"NotEqual":return[o.notEqual(w("a",r,t,e),w("b",r,t,e))];case"Greater":return[o.greater(w("a",r,t,e),w("b",r,t,e))];case"GreaterEqual":return[o.greaterEqual(w("a",r,t,e),w("b",r,t,e))];case"Less":return[o.less(w("a",r,t,e),w("b",r,t,e))];case"LessEqual":return[o.lessEqual(w("a",r,t,e),w("b",r,t,e))];case"LogicalAnd":return[o.logicalAnd(w("a",r,t,e),w("b",r,t,e))];case"LogicalNot":return[o.logicalNot(w("a",r,t,e))];case"LogicalOr":return[o.logicalOr(w("a",r,t,e),w("b",r,t,e))];case"Select":case"SelectV2":return[o.where(w("condition",r,t,e),w("a",r,t,e),w("b",r,t,e))];case"BitwiseAnd":return[o.bitwiseAnd(w("a",r,t,e),w("b",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var _W,DW=h(()=>{Le();xe();_W=(r,t,e,o=Lt)=>{switch(r.op){case"BatchMatMul":case"BatchMatMulV2":case"MatMul":return[o.matMul(w("a",r,t,e),w("b",r,t,e),w("transposeA",r,t,e),w("transposeB",r,t,e))];case"Einsum":return[o.einsum(w("equation",r,t,e),...w("tensors",r,t,e))];case"Transpose":return[o.transpose(w("x",r,t,e),w("perm",r,t,e))];case"_FusedMatMul":let[n,s]=w("fusedOps",r,t,e),a=n==="biasadd",i=s==="prelu",c=w("numArgs",r,t,e),l=w("leakyreluAlpha",r,t,e);if(a){if(i&&c!==2)throw new Error("Fused MatMul with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&c!==1)throw new Error("Fused MatMul with BiasAdd must have one extra argument: bias.")}let[u,p]=w("args",r,t,e);return[o.fused.matMul({a:w("a",r,t,e),b:w("b",r,t,e),transposeA:w("transposeA",r,t,e),transposeB:w("transposeB",r,t,e),bias:u,activation:s,preluActivationWeights:p,leakyreluAlpha:l})];case"MatrixBandPart":return[o.linalg.bandPart(w("a",r,t,e),w("numLower",r,t,e),w("numUpper",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var FW,OW=h(()=>{Le();xe();FW=(r,t,e,o=Lt)=>{switch(r.op){case"EuclideanNorm":return[o.euclideanNorm(w("x",r,t,e),w("axis",r,t,e),w("keepDims",r,t,e))];case"FusedBatchNorm":case"FusedBatchNormV2":return[o.batchNorm(w("x",r,t,e),w("mean",r,t,e),w("variance",r,t,e),w("offset",r,t,e),w("scale",r,t,e),w("epsilon",r,t,e))];case"FusedBatchNormV3":return[o.batchNorm(w("x",r,t,e),w("mean",r,t,e),w("variance",r,t,e),w("offset",r,t,e),w("scale",r,t,e),w("epsilon",r,t,e))];case"LRN":return[o.localResponseNormalization(w("x",r,t,e),w("radius",r,t,e),w("bias",r,t,e),w("alpha",r,t,e),w("beta",r,t,e))];case"Softmax":return[o.softmax(w("x",r,t,e))];case"LogSoftmax":return[o.logSoftmax(w("x",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var PW,LW=h(()=>{Le();xe();PW=(r,t,e,o=Lt)=>{switch(r.op){case"RaggedGather":{let{outputNestedSplits:n,outputDenseValues:s}=o.raggedGather(w("paramsNestedSplits",r,t,e),w("paramsDenseValues",r,t,e),w("indices",r,t,e),w("outputRaggedRank",r,t,e));return n.concat(s)}case"RaggedRange":{let{rtNestedSplits:n,rtDenseValues:s}=o.raggedRange(w("starts",r,t,e),w("limits",r,t,e),w("splits",r,t,e));return[n,s]}case"RaggedTensorToTensor":return[o.raggedTensorToTensor(w("shape",r,t,e),w("values",r,t,e),w("defaultValue",r,t,e),w("rowPartitionTensors",r,t,e),w("rowPartitionTypes",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var MW,BW=h(()=>{Le();xe();MW=(r,t,e,o=Lt)=>{switch(r.op){case"Max":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.max(w("x",r,t,e),i,c)]}case"Mean":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.mean(w("x",r,t,e),i,c)]}case"Min":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.min(w("x",r,t,e),i,c)]}case"Sum":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.sum(w("x",r,t,e),i,c)]}case"All":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.all(w("x",r,t,e),i,c)]}case"Any":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.any(w("x",r,t,e),i,c)]}case"ArgMax":{let i=w("axis",r,t,e);return[o.argMax(w("x",r,t,e),i)]}case"ArgMin":{let i=w("axis",r,t,e);return[o.argMin(w("x",r,t,e),i)]}case"Prod":{let i=w("axis",r,t,e),c=w("keepDims",r,t,e);return[o.prod(w("x",r,t,e),i,c)]}case"Cumprod":{let i=w("axis",r,t,e),c=w("exclusive",r,t,e),l=w("reverse",r,t,e);return[o.cumprod(w("x",r,t,e),i,c,l)]}case"Cumsum":{let i=w("axis",r,t,e),c=w("exclusive",r,t,e),l=w("reverse",r,t,e);return[o.cumsum(w("x",r,t,e),i,c,l)]}case"Bincount":let n=w("x",r,t,e),s=w("weights",r,t,e),a=w("size",r,t,e);return[o.bincount(n,s,a)];case"DenseBincount":{let i=w("x",r,t,e),c=w("weights",r,t,e),l=w("size",r,t,e),u=w("binaryOutput",r,t,e);return[o.denseBincount(i,c,l,u)]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var VW,zW=h(()=>{I();Le();xe();VW=(r,t,e,o=Lt)=>{switch(r.op){case"ConcatV2":case"Concat":{let n=w("n",r,t,e),s=w("axis",r,t,e),a=w("tensors",r,t,e);return a=a.slice(0,n),[o.concat(a,s)]}case"Gather":{let n=w("x",r,t,e),s=w("indices",r,t,e);return[o.gather(n,o.cast(s,"int32"),0)]}case"GatherV2":{let n=w("axis",r,t,e),s=w("batchDims",r,t,e),a=w("x",r,t,e),i=w("indices",r,t,e);return[o.gather(a,o.cast(i,"int32"),n,s)]}case"Reverse":{let n=w("dims",r,t,e),s=[];for(let i=0;i<n.length;i++)n[i]&&s.push(i);let a=w("x",r,t,e);return[o.reverse(a,s)]}case"ReverseV2":{let n=w("axis",r,t,e),s=w("x",r,t,e);return[o.reverse(s,n)]}case"Slice":{let n=w("begin",r,t,e),s=w("size",r,t,e);return[o.slice(w("x",r,t,e),n,s)]}case"StridedSlice":{let n=w("begin",r,t,e),s=w("end",r,t,e),a=w("strides",r,t,e),i=w("beginMask",r,t,e),c=w("endMask",r,t,e),l=w("ellipsisMask",r,t,e),u=w("newAxisMask",r,t,e),p=w("shrinkAxisMask",r,t,e),m=w("x",r,t,e);return[o.stridedSlice(m,n,s,a,i,c,l,u,p)]}case"Pack":return Tt(()=>{let n=w("axis",r,t,e),s=w("tensors",r,t,e),a=s[0].shape,i=o.squeeze(s[0]).shape,c=s.map(l=>{let u=b.arraysEqual(l.shape,a);if(!u&&!b.arraysEqual(o.squeeze(l).shape,i))throw new Error("the input tensors shape does not match");return u?l:o.reshape(l,a)});return[o.stack(c,n)]});case"Unpack":{let n=w("axis",r,t,e),s=w("tensor",r,t,e);return o.unstack(s,n)}case"Tile":{let n=w("reps",r,t,e);return[o.tile(w("x",r,t,e),n)]}case"Split":case"SplitV":{let n=w("axis",r,t,e),s=w("numOrSizeSplits",r,t,e),a=w("x",r,t,e);return o.split(a,s,n)}case"ScatterNd":{let n=w("indices",r,t,e),s=w("values",r,t,e),a=w("shape",r,t,e);return[o.scatterND(n,s,a)]}case"GatherNd":{let n=w("x",r,t,e),s=w("indices",r,t,e);return[o.gatherND(n,s)]}case"SparseToDense":{let n=w("sparseIndices",r,t,e),s=w("outputShape",r,t,e),a=w("sparseValues",r,t,e),i=w("defaultValue",r,t,e);return[o.sparseToDense(n,a,s,a.dtype===i.dtype?i:o.cast(i,a.dtype))]}case"TensorScatterUpdate":{let n=w("indices",r,t,e),s=w("values",r,t,e),a=w("tensor",r,t,e);return[o.tensorScatterUpdate(a,n,s)]}default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var GW,WW=h(()=>{Le();xe();GW=(r,t,e,o=Lt)=>{switch(r.op){case"SparseFillEmptyRows":{let{outputIndices:n,outputValues:s,emptyRowIndicator:a,reverseIndexMap:i}=o.sparse.sparseFillEmptyRows(w("indices",r,t,e),w("values",r,t,e),w("denseShape",r,t,e),w("defaultValue",r,t,e));return[n,s,a,i]}case"SparseReshape":{let{outputIndices:n,outputShape:s}=o.sparse.sparseReshape(w("inputIndices",r,t,e),w("inputShape",r,t,e),w("newShape",r,t,e));return[n,s]}case"SparseSegmentMean":return[o.sparse.sparseSegmentMean(w("data",r,t,e),w("indices",r,t,e),w("segmentIds",r,t,e))];case"SparseSegmentSum":return[o.sparse.sparseSegmentSum(w("data",r,t,e),w("indices",r,t,e),w("segmentIds",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var UW,HW=h(()=>{Le();xe();UW=(r,t,e,o=Lt)=>{switch(r.op){case"FFT":return[o.fft(w("x",r,t,e))];case"IFFT":return[o.ifft(w("x",r,t,e))];case"RFFT":return[o.rfft(w("x",r,t,e))];case"IRFFT":return[o.irfft(w("x",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var KW,qW=h(()=>{Le();xe();KW=(r,t,e,o=Lt)=>{switch(r.op){case"StaticRegexReplace":return[o.string.staticRegexReplace(w("input",r,t,e),w("pattern",r,t,e),w("rewrite",r,t,e),w("replaceGlobal",r,t,e))];case"StringNGrams":{let{nGrams:n,nGramsSplits:s}=o.string.stringNGrams(w("data",r,t,e),w("dataSplits",r,t,e),w("separator",r,t,e),w("nGramWidths",r,t,e),w("leftPad",r,t,e),w("rightPad",r,t,e),w("padWidth",r,t,e),w("preserveShortSequences",r,t,e));return[n,s]}case"StringSplit":{let{indices:n,values:s,shape:a}=o.string.stringSplit(w("input",r,t,e),w("delimiter",r,t,e),w("skipEmpty",r,t,e));return[n,s,a]}case"StringToHashBucketFast":return[o.string.stringToHashBucketFast(w("input",r,t,e),w("numBuckets",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});var XW,jW=h(()=>{Le();xe();XW=(r,t,e,o=Lt)=>{switch(r.op){case"Cast":return[o.cast(w("x",r,t,e),w("dtype",r,t,e))];case"ExpandDims":{let n=w("axis",r,t,e);return[o.expandDims(w("x",r,t,e),n)]}case"Squeeze":{let n=w("axis",r,t,e);return[o.squeeze(w("x",r,t,e),n)]}case"Reshape":return[o.reshape(w("x",r,t,e),w("shape",r,t,e))];case"EnsureShape":return[o.ensureShape(w("x",r,t,e),w("shape",r,t,e))];case"MirrorPad":return[o.mirrorPad(w("x",r,t,e),w("padding",r,t,e),w("mode",r,t,e))];case"PadV2":case"Pad":return[o.pad(w("x",r,t,e),w("padding",r,t,e),w("constantValue",r,t,e))];case"SpaceToBatchND":{let n=w("blockShape",r,t,e),s=w("paddings",r,t,e);return[o.spaceToBatchND(w("x",r,t,e),n,s)]}case"BatchToSpaceND":{let n=w("blockShape",r,t,e),s=w("crops",r,t,e);return[o.batchToSpaceND(w("x",r,t,e),n,s)]}case"DepthToSpace":{let n=w("blockSize",r,t,e),s=w("dataFormat",r,t,e).toUpperCase();return[o.depthToSpace(w("x",r,t,e),n,s)]}case"BroadcastTo":return[o.broadcastTo(w("x",r,t,e),w("shape",r,t,e))];case"BroadcastArgs":return[o.broadcastArgs(w("s0",r,t,e),w("s1",r,t,e))];default:throw TypeError(`Node type ${r.op} is not implemented`)}}});function Nw(r,t,e,o,n=Tt){let s=((a,i,c)=>{switch(a.category){case"arithmetic":return n(()=>eW(a,i,c));case"basic_math":return n(()=>oW(a,i,c));case"control":return mW(a,i,c);case"convolution":return n(()=>hW(a,i,c));case"creation":return n(()=>xW(a,i,c));case"dynamic":return bW(a,i,c);case"evaluation":return n(()=>wW(a,i,c));case"image":return n(()=>EW(a,i,c));case"graph":return n(()=>SW(a,i,c));case"logical":return n(()=>RW(a,i,c));case"matrices":return n(()=>_W(a,i,c));case"normalization":return n(()=>FW(a,i,c));case"ragged":return n(()=>PW(a,i,c));case"reduction":return n(()=>MW(a,i,c));case"slice_join":return n(()=>VW(a,i,c));case"sparse":return n(()=>GW(a,i,c));case"spectral":return n(()=>UW(a,i,c));case"string":return n(()=>KW(a,i,c));case"transformation":return n(()=>XW(a,i,c));case"hash_table":return IW(a,i,c,o);case"custom":let l=wg(a.op);if(l&&l.customExecutor)return l.customExecutor(new Fg(a,i,c));throw TypeError(`Custom op ${a.op} is not registered.`);default:throw TypeError(`Unknown op '${a.op}'. File an issue at https://github.com/tensorflow/tfjs/issues so we can add it, or register a custom execution with tf.registerOp()`)}})(r,t,e);return b.isPromise(s)?s.then(a=>[].concat(a)):[].concat(s)}var YW=h(()=>{I();tW();Cg();rW();nW();fW();gW();yW();vW();CW();NW();kW();$W();AW();DW();OW();LW();BW();zW();WW();HW();qW();jW();});var Rp,ZW=h(()=>{Rp=class{constructor(t={},e={},o={},n={},s){this.weightMap=t,this.tensorArrayMap=e,this.tensorListMap=o,this.functionMap=n,this.parseNodeNameCache=s,this.rootContext={id:0,frameName:"",iterationId:0},this.contexts=[this.rootContext],this.lastId=0,this.generateCurrentContextIds()}newFrame(t,e){return{id:t,frameName:e,iterationId:0}}set currentContext(t){this.contexts!==t&&(this.contexts=t,this.generateCurrentContextIds())}get currentContext(){return this.contexts}get currentContextId(){return this._currentContextIds[0]}get currentContextIds(){return this._currentContextIds}generateCurrentContextIds(){let t=[];for(let e=0;e<this.contexts.length-1;e++){let o=this.contexts.slice(0,this.contexts.length-e);t.push(this.contextIdforContexts(o))}t.push(""),this._currentContextIds=t}contextIdforContexts(t){return t?t.map(e=>e.id===0&&e.iterationId===0?"":`${e.frameName}-${e.iterationId}`).join("/"):""}enterFrame(t){this.contexts&&(this.lastId++,this.contexts=this.contexts.slice(),this.contexts.push(this.newFrame(this.lastId,t)),this._currentContextIds.unshift(this.contextIdforContexts(this.contexts)))}exitFrame(){if(this.contexts&&this.contexts.length>1)this.contexts=this.contexts.slice(),this.contexts.splice(-1),this.currentContextIds.shift();else throw new Error("Cannot exit frame, the context is empty")}nextIteration(){if(this.contexts&&this.contexts.length>0){this.contexts=this.contexts.slice(),this.lastId++;let t=Object.assign({},this.contexts[this.contexts.length-1]);t.iterationId+=1,t.id=this.lastId,this.contexts.splice(-1,1,t),this._currentContextIds.splice(0,1,this.contextIdforContexts(this.contexts))}else throw new Error("Cannot increase frame iteration, the context is empty")}getWeight(t){return this.weightMap[t]}addTensorArray(t){this.tensorArrayMap[t.id]=t}getTensorArray(t){return this.tensorArrayMap[t]}addTensorList(t){this.tensorListMap[t.id]=t}getTensorList(t){return this.tensorListMap[t]}dispose(t){for(let e in this.tensorArrayMap)this.tensorArrayMap[e].clearAndClose(t);for(let e in this.tensorListMap)this.tensorListMap[e].clearAndClose(t)}}});function Tw(r,t,e,o){let n=new Set,s=[],a=null,i=null,c=new Set,l=new Set(Object.keys(r).map(m=>lr(m)[0]));o=o||[];let u=new Set(o.map(m=>lr(m.name)[0])),p=[...t];for(;p.length>0;){let m=p.pop();if((cs(m)||jet(m)||Yet(m))&&a==null&&(a=m,i=a.children.map(f=>f.name).filter(f=>n.has(f))),n.add(m.name),e[m.name]==null&&!l.has(m.name)&&!u.has(m.name)){if(m.inputs.length===0){s.push(m.name);continue}m.inputs.forEach(f=>{c.has(f.name)||(c.add(f.name),p.push(f))})}}return{inputs:r,outputs:t,usedNodes:n,missingInputs:s,dynamicNode:a,syncInputs:i}}function QW(r,t){let{usedNodes:e,inputs:o}=t,n=Object.keys(o).map(g=>lr(g)[0]).map(g=>r.nodes[g]),s=r.initNodes||[],a=g=>e.has(typeof g=="string"?g:g.name);function i(g){return[...new Map(g.map(y=>[y.name,y])).values()]}let c=i([...n,...r.weights,...s]).filter(a),l=i([...c,...Object.values(r.nodes)]).filter(a),u=new Map(l.map(g=>[g.name,g])),p={};for(let g of l){p[g.name]=p[g.name]||0;for(let y of g.children)a(y)||(p[y.name]=Number.POSITIVE_INFINITY),p[y.name]=(p[y.name]||0)+1}let m=Object.entries(p).filter(([,g])=>g===0).map(([g])=>g),f=[...m];for(;m.length>0;){let g=m.pop(),y=u.get(g);for(let v of y.children.filter(a))--p[v.name]===0&&(f.push(v.name),m.push(v.name))}let d=f.map(g=>u.get(g)),x=Uet(d,c);return Het(x,c),x}function Uet(r,t){let e=new Map(r.map(a=>[a.name,a])),o=t.map(a=>a.name),n=new Set(o);for(;o.length>0;){let a=o.pop(),i=e.get(a);for(let c of i.children)!e.has(c.name)||n.has(c.name)||(n.add(c.name),o.push(c.name))}return r.filter(a=>n.has(a.name))}function Het(r,t){let e=new Map(r.map((i,c)=>[i.name,c])),o=new Set(t.map(i=>i.name)),n=i=>o.has(typeof i=="string"?i:i.name),s=new Set(r.map(i=>i.name)),a=i=>s.has(typeof i=="string"?i:i.name);for(let i of r){for(let c of i.children.filter(a)){if(!e.has(c.name))throw new Yl(`Child ${c.name} of node ${i.name} is unreachable.`);if(e.get(i.name)>e.get(c.name))throw new Yl(`Node ${i.name} is scheduled to run after its child ${c.name}.`)}if(!n(i))for(let c of i.inputs){if(!e.has(c.name))throw new Yl(`Input ${c.name} of node ${i.name} is unreachable.`);if(e.get(c.name)>e.get(i.name))throw new Yl(`Node ${i.name} is scheduled to run before its input ${c.name}.`)}}}function JW(r){let t=new Map(r.map((i,c)=>[i.name,c])),e=Number.MAX_SAFE_INTEGER,o=r.map((i,c)=>cs(i)?e:c),n=i=>{let c=o[t.get(i.name)];return c==null?-1:c},s=r.map((i,c)=>i.children.map(n).reduce((l,u)=>Math.max(l,u),o[c])),a=new Map;for(let i=0;i<r.length;++i){let c=s[i];if(c===e)continue;let l=r[i],u=r[c];a.has(u.name)||a.set(u.name,[]),a.get(u.name).push(l)}return a}function cs(r){return Ket.has(r.op)}function jet(r){return qet.has(r.op)}function Yet(r){return Xet.has(r.op)}var Yl,Ket,qet,Xet,t4=h(()=>{xe();Yl=class extends Error{constructor(t){super(`NodesExecutionOrderError: ${t}`)}};Ket=new Set(["Switch","Merge","Enter","Exit","NextIteration","StatelessIf","StatelessWhile","if","While"]),qet=new Set(["NonMaxSuppressionV2","NonMaxSuppressionV3","NonMaxSuppressionV5","Where"]),Xet=new Set(["HashTable","HashTableV2","LookupTableImport","LookupTableImportV2","LookupTableFind","LookupTableFindV2","LookupTableSize","LookupTableSizeV2"])});var Ap,e4=h(()=>{I();xe();YW();ZW();t4();Ap=class r{get weightIds(){return this.parent?this.parent.weightIds:this._weightIds}get functionExecutorMap(){return this.parent?this.parent.functionExecutorMap:this._functionExecutorMap}get weightMap(){return this.parent?this.parent.weightMap:this._weightMap}set weightMap(t){let e=Object.keys(t).map(o=>t[o].map(n=>n.id));this._weightIds=[].concat(...e),this._weightMap=t}set resourceManager(t){this._resourceManager=t}get inputs(){return this._inputs.map(t=>({name:t.name,shape:t.attrParams.shape?t.attrParams.shape.value:void 0,dtype:t.attrParams.dtype?t.attrParams.dtype.value:void 0}))}get outputs(){return this._outputs.map(t=>({name:t.name,shape:t.attrParams.shape?t.attrParams.shape.value:void 0,dtype:t.attrParams.dtype?t.attrParams.dtype.value:void 0}))}get inputNodes(){return this._inputs.map(t=>t.signatureKey||t.name)}get outputNodes(){return this._outputs.map(t=>{let e=t.signatureKey||t.name;return t.defaultOutput?`${e}:${t.defaultOutput}`:e})}get functions(){return Object.keys(this._functions).reduce((t,e)=>(t[e]=this._functions[e].signature,t),{})}constructor(t,e){this.graph=t,this.parent=e,this.compiledMap=new Map,this.parseNodeNameCache=new Map,this._weightMap={},this.SEPARATOR=",",this._functions={},this._functionExecutorMap={},this.keepIntermediateTensors=!1,this._outputs=t.outputs,this._inputs=t.inputs,this._initNodes=t.initNodes,this._signature=t.signature,this._functions=t.functions,t.functions!=null&&Object.keys(t.functions).forEach(o=>{this._functionExecutorMap[o]=new r(t.functions[o],this)})}getCompilationKey(t,e){let o=t.map(s=>s.name).sort(),n=e.map(s=>s.name).sort();return o.join(this.SEPARATOR)+"--"+n.join(this.SEPARATOR)}compile(t,e){let o=Tw(t,e,this.weightMap,this._initNodes),{missingInputs:n,dynamicNode:s,syncInputs:a}=o;if(s!=null)throw new Error(`This execution contains the node '${s.name}', which has the dynamic op '${s.op}'. Please use model.executeAsync() instead. Alternatively, to avoid the dynamic ops, specify the inputs [${a}]`);if(n.length>0){let l=e.map(p=>p.name),u=Object.keys(t);throw new Error(`Cannot compute the outputs [${l}] from the provided inputs [${u}]. Missing the following inputs: [${n}]`)}let i=QW(this.graph,o),c=JW(i);return{orderedNodes:i,nodeLiveUntilMap:c}}cloneAndKeepTensor(t){if(t==null)return null;let e=t.clone();return fr(e),e}cloneTensorList(t){return t?t.map(o=>this.cloneAndKeepTensor(o)):null}cloneTensorMap(t){return Object.fromEntries(Object.entries(t).map(([e,o])=>[e,this.cloneTensorList(o)]))}execute(t,e){this.disposeIntermediateTensors(),t=this.mapInputs(t);let o=Object.keys(t).sort();this.checkInputs(t),this.checkInputShapeAndType(t),e=this.mapOutputs(e),this.checkOutputs(e);let n=o.map(m=>this.graph.nodes[lr(m)[0]]),s=e.map(m=>lr(m)[0]),a=new Set(s),i=s.map(m=>this.graph.nodes[m]);i.length===0&&(i=this._outputs);let c=this.getCompilationKey(n,i),l=this.compiledMap.get(c);l==null&&(l=this.compile(t,i),this.compiledMap.set(c,l));try{this.keepIntermediateTensors=O().getBool("KEEP_INTERMEDIATE_TENSORS")}catch(m){this.keepIntermediateTensors=!1,console.warn(m.message)}let u={},p={};return Tt(()=>{let m=new Rp(this.weightMap,u,p,this.functionExecutorMap,this.parseNodeNameCache),f=Object.assign({},this.weightMap);this.keepIntermediateTensors&&(this.clonedTensorsMap=this.cloneTensorMap(this.weightMap)),Object.keys(t).forEach(y=>{let[v,N]=lr(y,m),S=[];S[N]=t[y],f[v]=S,this.keepIntermediateTensors&&(this.clonedTensorsMap[v]=this.cloneTensorList(S))});let d=this.getFrozenTensorIds(f),{orderedNodes:x,nodeLiveUntilMap:g}=l;for(let y of x){if(f[y.name])continue;let v=Nw(y,f,m,this._resourceManager);if(b.isPromise(v))throw new Error(`The execution of the op '${y.op}' returned a promise. Please use model.executeAsync() instead.`);f[y.name]=v,this.keepIntermediateTensors&&(this.clonedTensorsMap[y.name]=this.cloneTensorList(v)),this.checkTensorForDisposalWithNodeLiveUntilInfo(y,f,m,d,a,g.get(y.name))}return this.parent==null&&m.dispose(d),e.map(y=>Ce(y,f,m))})}getFrozenTensorIds(t){let e=[].concat.apply([],Object.keys(t).map(o=>t[o]).map(o=>o.map(n=>n.id)));return new Set(e)}checkTensorForDisposal(t,e,o,n,s,a,i){if(!(cs(e)||a.has(t))){for(let c of o[t])c!=null&&(i[c.id]=(i[c.id]||0)+e.children.length);for(let c of e.inputs){if(cs(c))continue;let l=tw(c.name,o,n);if(l!=null)for(let u of l){if(!u||u.kept||s.has(u.id))continue;let p=i[u.id];p===1?(u.dispose(),delete i[u.id]):p!=null&&i[u.id]--}}}}checkTensorForDisposalWithNodeLiveUntilInfo(t,e,o,n,s,a){function i(c){return cs(c)||s.has(c.name)}if(!(cs(t)||a==null))for(let c of a){if(i(c))continue;let l=tw(c.name,e,o);for(let u of l)!u||u.kept||n.has(u.id)||u.dispose()}}async executeAsync(t,e){return this._executeAsync(t,e)}disposeIntermediateTensors(){this.clonedTensorsMap&&(Object.values(this.clonedTensorsMap).forEach(t=>{for(let e of t)e&&!e.isDisposed&&e.dispose()}),this.clonedTensorsMap=null)}getIntermediateTensors(){return this.clonedTensorsMap}async _executeAsync(t,e,o=!1,n={},s={}){this.disposeIntermediateTensors(),o||(t=this.mapInputs(t),this.checkInputs(t),this.checkInputShapeAndType(t),e=this.mapOutputs(e),this.checkOutputs(e));try{this.keepIntermediateTensors=O().getBool("KEEP_INTERMEDIATE_TENSORS")}catch(m){this.keepIntermediateTensors=!1,console.warn(m.message)}let a=new Rp(this.weightMap,n,s,this.functionExecutorMap,this.parseNodeNameCache);this.keepIntermediateTensors&&(this.clonedTensorsMap=this.cloneTensorMap(this.weightMap));let i=await this.executeWithControlFlow(t,a,e,o),c=e.map(m=>Ce(m,i,a)),l=c.map(m=>m.id),u=Object.keys(t).map(m=>t[m].id),p=new Set([...l,...u,...this.weightIds]);return Object.values(i).forEach(m=>{m.forEach(f=>{f&&!f.isDisposed&&!p.has(f.id)&&f.dispose()})}),this.parent==null&&a.dispose(p),c}async executeFunctionAsync(t,e,o){let n=t.reduce((s,a,i)=>(s[this.inputs[i].name]=a,s),{});return this._executeAsync(n,this.outputNodes,!0,e,o)}async executeWithControlFlow(t,e,o,n){let s=Object.keys(t),a=s.map(S=>this.graph.nodes[lr(S)[0]]),i=o.map(S=>lr(S)[0]),c=new Set(i),l=i.map(S=>this.graph.nodes[S]);l.length===0&&(l=this._outputs);let{usedNodes:u,missingInputs:p,dynamicNode:m,syncInputs:f}=Tw(t,l,this.weightMap,this._initNodes),d=[...a,...this.graph.weights,...this._initNodes||[]].map(S=>({node:S,contexts:e.currentContext})),x=Object.assign({},this.weightMap);Object.keys(t).forEach(S=>{let[R,A]=lr(S),_=[];_[A]=t[S],x[R]=_});let g={},y=this.getFrozenTensorIds(x),v={};for(;d.length>0;){let S=this.processStack(a,d,e,x,v,y,c,g,u);await Promise.all(S)}m==null&&!n&&console.warn("This model execution did not contain any nodes with control flow or dynamic output shapes. You can use model.execute() instead.");let N=l.filter(S=>!cs(S)&&!Ce(S.name,x,e)).map(S=>S.name);if(N.length>0){let S="";throw m!=null&&(S=`Alternatively, to avoid the dynamic ops, use model.execute() and specify the inputs [${f}]`),new Error(`Cannot compute the outputs [${N}] from the provided inputs [${s}]. Consider providing the following inputs: [${p}]. ${S}`)}return x}processStack(t,e,o,n,s,a,i,c,l){let u=[];for(;e.length>0;){let p=e.pop();o.currentContext=p.contexts;let m="";if(p.node.op==="Enter"&&w("isConstant",p.node,n,o)&&([m]=ko(p.node.name,o)),n[p.node.name]==null){let f=Nw(p.node,n,o,this._resourceManager);m||([m]=ko(p.node.name,o));let d=o.currentContext;b.isPromise(f)?u.push(f.then(x=>(n[m]=x,this.keepIntermediateTensors&&(this.clonedTensorsMap[m]=this.cloneTensorList(x)),o.currentContext=d,this.checkTensorForDisposal(m,p.node,n,o,a,i,c),this.processChildNodes(p.node,e,o,n,s,l),x))):(n[m]=f,this.keepIntermediateTensors&&(this.clonedTensorsMap[m]=this.cloneTensorList(f)),this.checkTensorForDisposal(m,p.node,n,o,a,i,c),this.processChildNodes(p.node,e,o,n,s,l))}else this.processChildNodes(p.node,e,o,n,s,l)}return u}processChildNodes(t,e,o,n,s,a){t.children.forEach(i=>{let[c]=ko(i.name,o);s[c]||!a.has(i.name)||(i.op==="Merge"?i.inputNames.some(l=>!!Ce(l,n,o))&&(s[c]=!0,e.push({contexts:o.currentContext,node:i})):i.inputNames.every(l=>!!Ce(l,n,o))&&(s[c]=!0,e.push({contexts:o.currentContext,node:i})))})}dispose(){Object.keys(this.weightMap).forEach(t=>this.weightMap[t].forEach(e=>e.dispose()))}checkInputShapeAndType(t){Object.keys(t).forEach(e=>{let o=t[e],[n]=lr(e),s=this.graph.nodes[n];if(s.attrParams.shape&&s.attrParams.shape.value){let a=s.attrParams.shape.value,i=a.length===o.shape.length&&o.shape.every((c,l)=>a[l]===-1||a[l]===c);b.assert(i,()=>`The shape of dict['${s.name}'] provided in model.execute(dict) must be [${a}], but was [${o.shape}]`)}s.attrParams.dtype&&s.attrParams.dtype.value&&b.assert(o.dtype===s.attrParams.dtype.value,()=>`The dtype of dict['${s.name}'] provided in model.execute(dict) must be ${s.attrParams.dtype.value}, but was ${o.dtype}`)})}mapInputs(t){var e,o;let n={};for(let s in t){let a=(o=(e=this._signature)===null||e===void 0?void 0:e.inputs)===null||o===void 0?void 0:o[s];a!=null?n[a.name]=t[s]:n[s]=t[s]}return n}checkInputs(t){let e=Object.keys(t).filter(o=>{let[n]=lr(o);return this.graph.nodes[n]==null});if(e.length>0)throw new Error(`The dict provided in model.execute(dict) has keys: [${e}] that are not part of graph`)}mapOutputs(t){return t.map(e=>{var o,n;let s=(n=(o=this._signature)===null||o===void 0?void 0:o.outputs)===null||n===void 0?void 0:n[e];return s!=null?s.name:e},{})}checkOutputs(t){t.forEach(e=>{let[o]=lr(e);if(!this.graph.nodes[o])throw new Error(`The output '${e}' is not found in the graph`)})}}});var Mg,r4=h(()=>{Mg=class{constructor(t={},e={}){this.hashTableNameToHandle=t,this.hashTableMap=e}addHashTable(t,e){this.hashTableNameToHandle[t]=e.handle,this.hashTableMap[e.id]=e}getHashTableHandleByName(t){return this.hashTableNameToHandle[t]}getHashTableById(t){return this.hashTableMap[t]}dispose(){for(let t in this.hashTableMap)this.hashTableMap[t].clearAndClose(),delete this.hashTableMap[t];for(let t in this.hashTableNameToHandle)this.hashTableNameToHandle[t].dispose(),delete this.hashTableNameToHandle[t]}}});async function Vg(r,t={},e=Zu){if(r==null)throw new Error("modelUrl in loadGraphModel() cannot be null. Please provide a url or an IOHandler that loads the model");t==null&&(t={}),t.fromTFHub&&typeof r=="string"&&(r=Jet(r));let o=new Bg(r,t,e);return await o.load(),o}function Jet(r){return r.endsWith("/")||(r=r+"/"),`${r}${Qet}${Zet}`}var Zet,Qet,Bg,o4=h(()=>{I();ww();e4();r4();Mn();Zet="?tfjs-format=file",Qet="model.json",Bg=class{get modelVersion(){return this.version}get inputNodes(){return this.executor.inputNodes}get outputNodes(){return this.executor.outputNodes}get inputs(){return this.executor.inputs}get outputs(){return this.executor.outputs}get weights(){return this.executor.weightMap}get metadata(){return this.artifacts.userDefinedMetadata}get modelSignature(){return this.signature}get modelStructuredOutputKeys(){return this.structuredOutputKeys}constructor(t,e={},o=Zu){this.modelUrl=t,this.loadOptions=e,this.version="n/a",this.io=o,e==null&&(this.loadOptions={}),this.resourceManager=new Mg}findIOHandler(){let t=this.modelUrl;if(t.load!=null)this.handler=t;else if(this.loadOptions.requestInit!=null)this.handler=this.io.browserHTTPRequest(t,this.loadOptions);else{let e=this.io.getLoadHandlers(t,this.loadOptions);if(e.length===0)e.push(this.io.browserHTTPRequest(t,this.loadOptions));else if(e.length>1)throw new Error(`Found more than one (${e.length}) load handlers for URL '${[t]}'`);this.handler=e[0]}}load(){if(this.findIOHandler(),this.handler.load==null)throw new Error("Cannot proceed with model loading because the IOHandler provided does not have the `load` method implemented.");let t=this.handler.load();return b.isPromise(t)?t.then(e=>e.getWeightStream==null?this.loadSync(e):this.loadStreaming(e)):this.loadSync(t)}loadSync(t){let e=this.io.decodeWeights(t.weightData,t.weightSpecs);return this.loadWithWeightMap(t,e)}async loadStreaming(t){if(t.getWeightStream==null)throw new Error("Model artifacts missing streamWeights function");let e=await dm(t.getWeightStream(),t.weightSpecs);return this.loadWithWeightMap(t,e)}loadWithWeightMap(t,e){this.artifacts=t;let o=this.artifacts.modelTopology,n=this.artifacts.signature;if(this.artifacts.userDefinedMetadata!=null){let s=this.artifacts.userDefinedMetadata;s.signature!=null&&(n=s.signature),s.structuredOutputKeys!=null&&(this.structuredOutputKeys=s.structuredOutputKeys)}if(this.signature=n,this.version=`${o.versions.producer}.${o.versions.minConsumer}`,this.executor=new Ap($p.Instance.transformGraph(o,this.signature)),this.executor.weightMap=this.convertTensorMapToTensorsMap(e),this.executor.resourceManager=this.resourceManager,t.modelInitializer!=null&&t.modelInitializer.node!=null){let s=$p.Instance.transformGraph(t.modelInitializer);this.initializer=new Ap(s),this.initializer.weightMap=this.executor.weightMap,this.initializer.resourceManager=this.resourceManager,this.initializerSignature=t.initializerSignature}return!0}async save(t,e){if(typeof t=="string"){let o=this.io.getSaveHandlers(t);if(o.length===0)throw new Error(`Cannot find any save handlers for URL '${t}'`);if(o.length>1)throw new Error(`Found more than one (${o.length}) save handlers for URL '${t}'`);t=o[0]}if(t.save==null)throw new Error("GraphModel.save() cannot proceed because the IOHandler provided does not have the `save` attribute defined.");return t.save(this.artifacts)}addStructuredOutputNames(t){if(this.structuredOutputKeys){let e=t instanceof ee?[t]:t,o={};return e.forEach((n,s)=>o[this.structuredOutputKeys[s]]=n),o}return t}predict(t,e){let o=this.execute(t,this.outputNodes);return this.addStructuredOutputNames(o)}async predictAsync(t,e){let o=await this.executeAsync(t,this.outputNodes);return this.addStructuredOutputNames(o)}normalizeInputs(t){var e;if(!(t instanceof ee)&&!Array.isArray(t)){let s=(e=this.signature)===null||e===void 0?void 0:e.inputs;if(s!=null)for(let a in s){let i=s[a];i.resourceId!=null&&(t[a]=this.resourceIdToCapturedInput[i.resourceId])}return t}t=Array.isArray(t)?t:[t];let o=Object.keys(this.resourceIdToCapturedInput).length;if(t.length+o!==this.inputNodes.length)throw new Error(`Input tensor count mismatch, the graph model has ${this.inputNodes.length-o} non-resource placeholders, while there are ${t.length} input tensors provided.`);let n=0;return this.inputNodes.reduce((s,a)=>{var i,c,l;let u=(l=(c=(i=this.signature)===null||i===void 0?void 0:i.inputs)===null||c===void 0?void 0:c[a])===null||l===void 0?void 0:l.resourceId;return u!=null?s[a]=this.resourceIdToCapturedInput[u]:s[a]=t[n++],s},{})}normalizeOutputs(t){return t=t||this.outputNodes,Array.isArray(t)?t:[t]}executeInitializerGraph(){return this.initializer==null?[]:this.initializerSignature==null?this.initializer.execute({},[]):this.initializer.execute({},Object.keys(this.initializerSignature.outputs))}async executeInitializerGraphAsync(){return this.initializer==null?[]:this.initializerSignature==null?this.initializer.executeAsync({},[]):this.initializer.executeAsync({},Object.keys(this.initializerSignature.outputs))}setResourceIdToCapturedInput(t){if(this.resourceIdToCapturedInput={},this.initializerSignature){let e=this.initializerSignature.outputs,o=Object.keys(e);for(let n=0;n<o.length;n++){let s=o[n],a=e[s];this.resourceIdToCapturedInput[a.resourceId]=t[n]}}}execute(t,e){this.resourceIdToCapturedInput==null&&this.setResourceIdToCapturedInput(this.executeInitializerGraph()),t=this.normalizeInputs(t),e=this.normalizeOutputs(e);let o=this.executor.execute(t,e);return o.length>1?o:o[0]}async executeAsync(t,e){this.resourceIdToCapturedInput==null&&this.setResourceIdToCapturedInput(await this.executeInitializerGraphAsync()),t=this.normalizeInputs(t),e=this.normalizeOutputs(e);let o=await this.executor.executeAsync(t,e);return o.length>1?o:o[0]}getIntermediateTensors(){return this.executor.getIntermediateTensors()}disposeIntermediateTensors(){this.executor.disposeIntermediateTensors()}convertTensorMapToTensorsMap(t){return Object.keys(t).reduce((e,o)=>(e[o]=[t[o]],e),{})}dispose(){this.executor.dispose(),this.initializer&&(this.initializer.dispose(),this.resourceIdToCapturedInput&&se(this.resourceIdToCapturedInput)),this.resourceManager.dispose()}}});var n4=h(()=>{});var s4=h(()=>{$G();o4();Cg();n4();});var Iw=h(()=>{"use strict"});var a4=h(()=>{"use strict";Iw()});function Nn(r,t,e){return{y:r[t+e*3],x:r[t+e*3+1],s:r[t+e*3+2]}}function wrt(r,t){var e=Math.min(r[2],t[2])-Math.max(r[0],t[0]),o=Math.min(r[3],t[3])-Math.max(r[1],t[1]);if(!(e>0)||!(o>0))return 0;var n=e*o,s=(r[2]-r[0])*(r[3]-r[1])+(t[2]-t[0])*(t[3]-t[1])-n;return s>0?n/s:0}function Srt(r,t,e){var o=r&&r.unionHeld,n=o&&o[t];return!!(n&&n[e])}function c4(r,t,e,o){var n=typeof t=="number"?t:rrt,s=typeof e=="number"&&e>0?e:16/9,a=[],i=[],c=o&&o.length?o:null,l=c?new Array(c.length).fill(!1):null;ai.length=0;for(var u=0;u<6;u++){let Tn=function(y4){var Ew=i[p];return!!(Ew&&Ew[y4])};for(var Rrt=Tn,p=u*56,m=r[p+55],f=0,d=0,x=0,g=0,y=0,v=1,N=1,S=0,R=0,A=0;A<brt;A++){var _=r[p+A*3+2];if(_>=fo){f++,g|=1<<A;var D=r[p+A*3],L=r[p+A*3+1];L<v&&(v=L),L>S&&(S=L),D<N&&(N=D),D>R&&(R=D)}_>=.15&&x++,_>d&&(d=_),A<=ls&&_>y&&(y=_)}var M=Math.min(r[p+Op*3+2],r[p+Pp*3+2]);ai.push({score:Math.round(m*1e3)/1e3,confident:f,maxKp:Math.round(d*1e3)/1e3,nKp15:x,kb:g,hk:Math.round(y*100)/100,sk:Math.round(M*100)/100,hwE:r[p+_p*3+2]>=fo&&r[p+ls*3+2]>=fo?Math.round(Math.abs(r[p+_p*3+1]-r[p+ls*3+1])*1e3)/1e3:null,hwY:r[p+Dp*3+2]>=fo&&r[p+Fp*3+2]>=fo?Math.round(Math.abs(r[p+Dp*3+1]-r[p+Fp*3+1])*1e3)/1e3:null,hwS:r[p+Op*3+2]>=fo&&r[p+Pp*3+2]>=fo?Math.round(Math.abs(r[p+Op*3+1]-r[p+Pp*3+1])*1e3)/1e3:null,k:f?[Math.round(v*1e3)/1e3,Math.round(N*1e3)/1e3,Math.round(S*1e3)/1e3,Math.round(R*1e3)/1e3]:null,h:Math.round((r[p+53]-r[p+51])*100)/100,b:[Math.round(r[p+52]*100)/100,Math.round(r[p+51]*100)/100,Math.round(r[p+54]*100)/100,Math.round(r[p+53]*100)/100],bb:[r[p+52],r[p+51],r[p+54],r[p+53]],adm:0});var V=m>=ort&&f>=nrt,W=x>=crt&&d>=lrt,G=-1;if(c&&!(m>=n)&&!V&&m>=prt&&f>=frt){for(var K=[r[p+52],r[p+51],r[p+54],r[p+53]],U=mrt,j=0;j<c.length;j++)if(!l[j]){var Z=c[j];if(!(!Z||!Z.raw)&&!((Z.hold||0)>=drt)){var q=wrt(K,Z.raw);q>=U&&(U=q,G=j)}}}if(!(G===-1&&(!(m>=n)&&!V&&!W||!W&&f<irt))){for(var Q=G===-1&&W&&!V&&!(m>=n),rt=Q?urt:fo,et=[],st=0;st<=ls;st++){var ot=Nn(r,p,st);ot.s>=fo&&et.push(ot)}var at=Nn(r,p,Op),nt=Nn(r,p,Pp),lt=at.s>=fo&&nt.s>=fo,xt=et.length>0||lt||Q&&(Math.max(r[p+vrt*3+2],r[p+Dp*3+2],r[p+Fp*3+2],r[p+_p*3+2],r[p+ls*3+2])>=rt||Math.min(at.s,nt.s)>=rt);if(xt){for(var gt=r[p+51],ht=r[p+52],Ct=r[p+53],It=r[p+54],Mt=ht,Ht=gt,Zt=It,Kt=Ct,Ut=Math.min(hrt*s,Math.max(xrt*s,(Ct-gt)*grt)),Qt=Ut/s,jt=0;jt<yrt;jt++){var te=Nn(r,p,jt),Ne=te.s>=fo||Srt(o,p,jt)&&te.s>=Crt;i[p]||(i[p]=[]),i[p][jt]=Ne,Ne&&(te.y-Ut<gt&&(gt=te.y-Ut),te.y+Ut>Ct&&(Ct=te.y+Ut),te.x-Qt<ht&&(ht=te.x-Qt),te.x+Qt>It&&(It=te.x+Qt),te.y<Ht&&(Ht=te.y),te.y>Kt&&(Kt=te.y),te.x<Mt&&(Mt=te.x),te.x>Zt&&(Zt=te.x))}for(var Te=null,le=null,$o=null,Tr=null,He=[],Gr=0;Gr<=ls;Gr++)Tn(Gr)&&He.push(Nn(r,p,Gr));if(He.length||(He=et),et.length){Te=0,le=0;for(var Wr=0;Wr<He.length;Wr++)Te+=He[Wr].x,le+=He[Wr].y;Te/=He.length,le/=He.length;var Ro=Nn(r,p,_p),us=Nn(r,p,ls),Zl=Nn(r,p,Dp),Ql=Nn(r,p,Fp),tr=0;Tn(_p)&&Tn(ls)?tr=Math.abs(Ro.x-us.x):Tn(Dp)&&Tn(Fp)?tr=Math.abs(Zl.x-Ql.x)*2.5:Tn(Op)&&Tn(Pp)&&(tr=Math.abs(at.x-nt.x)*.6),tr=Math.max(tr,.04),$o=tr;var Ir=tr*s;Tr=Ir,le-Ir*zg<gt&&(gt=le-Ir*zg),le+Ir*.9>Ct&&(Ct=le+Ir*.9),Te-tr*1.2<ht&&(ht=Te-tr*1.2),Te+tr*1.2>It&&(It=Te+tr*1.2),le-Ir*zg<Ht&&(Ht=le-Ir*zg),le+Ir*.9>Kt&&(Kt=le+Ir*.9),Te-tr*1.2<Mt&&(Mt=Te-tr*1.2),Te+tr*1.2>Zt&&(Zt=Te+tr*1.2)}var Mp=(It-ht)*i4,Bp=(Ct-gt)*i4;if(!(m>=n)){var x4=Math.max(1e-6,(r[p+53]-r[p+51])*(r[p+54]-r[p+52]));if((It-ht)*(Ct-gt)>x4*srt)continue}a.push({y1:Math.max(0,gt-Bp),x1:Math.max(0,ht-Mp),y2:Math.min(1,Ct+Bp),x2:Math.min(1,It+Mp),confidence:m,headX:Te,headY:le,headW:$o,headH:Tr,raw:[r[p+52],r[p+51],r[p+54],r[p+53]],core:{x1:Math.max(0,Math.min(Mt,Zt)),y1:Math.max(0,Math.min(Ht,Kt)),x2:Math.min(1,Math.max(Mt,Zt)),y2:Math.min(1,Math.max(Ht,Kt))},hold:G===-1?0:(c[G].hold||0)+1}),G!==-1&&(l[G]=!0),ai[u].adm=1}}}return a.unionHeld=i,a}function l4(r){if(!r||!r.length)return null;for(var t=0,e=0;e<r.length;e++){var o=r[e]&&r[e].maxKp;typeof o=="number"&&o>t&&(t=o)}return t}function u4(r){if(!r||!r.length)return!1;for(var t=0,e=0;e<r.length;e++){var o=r[e],n=o&&o.maxKp;typeof n=="number"&&n>t&&(t=n)}return t<art}function p4(r){var t=[];if(!r||!r.length)return t;for(var e=0;e<r.length;e++){var o=r[e];if(!(!o||o.adm)){var n=o.bb;!n||n.length!==4||!(n[2]>n[0])||!(n[3]>n[1])||t.push({x1:n[0],y1:n[1],x2:n[2],y2:n[3]})}}return t}var rrt,ort,nrt,srt,art,i4,zg,fo,irt,crt,lrt,urt,prt,mrt,frt,drt,hrt,grt,xrt,yrt,brt,vrt,_p,ls,Dp,Fp,Op,Pp,ai,Crt,m4=h(()=>{"use strict";rrt=.35,ort=.12,nrt=7,srt=3,art=.1,i4=.045,zg=1.6,fo=.3,irt=5,crt=8,lrt=.25,urt=.2,prt=.22,mrt=.4,frt=3,drt=8,hrt=.05,grt=.1,xrt=.03,yrt=17,brt=13,vrt=0,_p=3,ls=4,Dp=1,Fp=2,Op=5,Pp=6;ai=[];Crt=.22});var f4=h(()=>{"use strict"});function Nrt(r){for(var t=atob(r),e=t.length,o=new Uint8Array(e),n=0;n<e;n++)o[n]=t.charCodeAt(n);return o.buffer}function Trt(r,t){for(var e=[],o=0;o<r.weightsManifest.length;o++)for(var n=r.weightsManifest[o],s=0;s<n.weights.length;s++)e.push(n.weights[s]);return{modelTopology:r.modelTopology,weightSpecs:e,weightData:t,format:r.format,generatedBy:r.generatedBy,convertedBy:r.convertedBy,signature:r.signature,userDefinedMetadata:r.userDefinedMetadata}}function Irt(r,t){return{load:function(){return Promise.resolve(Trt(r,Nrt(t)))}}}function krt(){return kw||(kw=(async function(){try{O().set("WEBGL_USE_SHAPES_UNIFORMS",!0);var r=await uu("webgl");if(!r)throw new Error("webgl backend unavailable");await pu()}catch{await uu("cpu"),await pu()}})()),kw}function d4(r){return Vg(r)}async function h4(r,t,e,o,n){var s=Tt(function(){var c=n||Qu.fromPixels(t),l=Lf.resizeBilinear(_r(c,0),[Lp,Lp]);return r.execute(_t(l,"int32"))}),a;try{a=await s.data()}finally{se(s)}var i=c4(a,void 0,e,o);return i.noHumanShape=u4(ai),i.maxKp=l4(ai),i.rejectedBoxes=p4(ai),i}var kw,Lp,g4=h(()=>{"use strict";I();k3();EG();kv();s4();a4();m4();f4();Iw();try{typeof window!="undefined"&&(window.__TS_GAZE_SEG_SPIKE=async function(r,t,e){try{var o=e||{},n=o.size||256,s=o.iters||30;await krt();var a=(typeof performance!="undefined"?performance:Date).now(),i=await Vg(Irt(JSON.parse(r),t)),c=(typeof performance!="undefined"?performance:Date).now()-a,l=document.querySelector("video");if(!l)return{error:"no video element"};for(var u=[],p=[],m=0;m<s;m++){var f=(typeof performance!="undefined"?performance:Date).now(),d=Tt(function(){var y=Qu.fromPixels(l),v=Lf.resizeBilinear(_r(y,0),[n,n]);return i.execute(Dt(_t(v,"float32"),255))}),x=await d.data();se(d);var g=(typeof performance!="undefined"?performance:Date).now();(m<5?u:p).push(+(g-f).toFixed(2)),m===s-1&&u.push(x.length)}return p.sort(function(y,v){return y-v}),i.dispose(),{loadMs:+c.toFixed(1),size:n,iters:p.length,warmup:u.slice(0,5),p50:p[Math.floor(p.length*.5)],p90:p[Math.floor(p.length*.9)],min:p[0],max:p[p.length-1],backend:ya(),mem:Nx().numTensors}}catch(y){return{error:String(y&&y.message||y)}}})}catch{}kw=null;Lp=256;try{typeof window!="undefined"&&(window.__TS_GAZE_MEM=function(){try{return Nx()}catch{return null}})}catch{}});var $rt=Ur(()=>{I();kv();g4();async function Ert(r){var t=await fetch(r,{mode:"cors"}),e=await t.blob();return createImageBitmap(e,{resizeWidth:Lp,resizeHeight:Lp,resizeQuality:"high"})}self.onmessage=async function(r){var t=r.data&&r.data.ids;if(t)try{await uu("webgl"),await pu();var e=O(),o={};["WEBGL_VERSION","WEBGL_RENDER_FLOAT32_CAPABLE","WEBGL_RENDER_FLOAT32_ENABLED","WEBGL_FORCE_F16_TEXTURES","WEBGL_PACK","WEBGL_DOWNLOAD_FLOAT_ENABLED","WEBGL_MAX_TEXTURE_SIZE"].forEach(function(u){try{o[u]=e.get(u)}catch{o[u]=null}}),self.postMessage({prog:"loading-model"});var n=await d4("/person/model.json");self.postMessage({prog:"model-loaded",backend:ya(),flags:o});for(var s=[],a=0;a<t.length;a++){self.postMessage({prog:"infer-"+a});var i;try{i=await Ert("https://i.ytimg.com/vi/"+t[a]+"/hqdefault.jpg")}catch{continue}var c=await h4(n,i,16/9,null,null);i.close(),s.push({id:t[a],admitted:c.length,maxKp:typeof c.maxKp=="number"?c.maxKp:null,noShape:!!c.noHumanShape,rejected:(c.rejectedBoxes||[]).length})}n.dispose();var l=s.map(function(u){return u.maxKp===null?0:u.maxKp}).sort(function(u,p){return u-p});self.postMessage({done:!0,backend:ya(),flags:o,n:s.length,admittedTotal:s.reduce(function(u,p){return u+p.admitted},0),framesWithNobody:s.filter(function(u){return u.admitted===0}).length,maxKpP50:l.length?l[Math.floor(l.length/2)]:null,maxKpMax:l.length?l[l.length-1]:null,noShapeFrames:s.filter(function(u){return u.noShape}).length,rows:s})}catch(u){self.postMessage({error:String(u&&u.stack||u)})}}});$rt();})();
/*! Bundled license information:

@tensorflow/tfjs-core/dist/backends/backend.js:
@tensorflow/tfjs-core/dist/util_base.js:
@tensorflow/tfjs-core/dist/global_util.js:
@tensorflow/tfjs-core/dist/ops/complex.js:
@tensorflow/tfjs-core/dist/ops/clone.js:
@tensorflow/tfjs-core/dist/ops/add.js:
@tensorflow/tfjs-core/dist/ops/floorDiv.js:
@tensorflow/tfjs-core/dist/ops/div.js:
@tensorflow/tfjs-core/dist/ops/mul.js:
@tensorflow/tfjs-core/dist/ops/add_n.js:
@tensorflow/tfjs-core/dist/ops/all.js:
@tensorflow/tfjs-core/dist/ops/any.js:
@tensorflow/tfjs-core/dist/ops/atan2.js:
@tensorflow/tfjs-core/dist/ops/conv_util.js:
@tensorflow/tfjs-core/dist/ops/reshape.js:
@tensorflow/tfjs-core/dist/ops/avg_pool.js:
@tensorflow/tfjs-core/dist/ops/avg_pool_3d.js:
@tensorflow/tfjs-core/dist/ops/concat.js:
@tensorflow/tfjs-core/dist/ops/mat_mul.js:
@tensorflow/tfjs-core/dist/ops/basic_lstm_cell.js:
@tensorflow/tfjs-core/dist/ops/batch_to_space_nd.js:
@tensorflow/tfjs-core/dist/ops/batchnorm.js:
@tensorflow/tfjs-core/dist/ops/bincount.js:
@tensorflow/tfjs-core/dist/ops/broadcast_to.js:
@tensorflow/tfjs-core/dist/ops/fill.js:
@tensorflow/tfjs-core/dist/ops/conv2d.js:
@tensorflow/tfjs-core/dist/ops/conv2d_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/conv3d.js:
@tensorflow/tfjs-core/dist/ops/conv3d_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/dense_bincount.js:
@tensorflow/tfjs-core/dist/ops/depth_to_space.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d.js:
@tensorflow/tfjs-core/dist/ops/diag.js:
@tensorflow/tfjs-core/dist/ops/dilation2d.js:
@tensorflow/tfjs-core/dist/ops/equal.js:
@tensorflow/tfjs-core/dist/ops/where.js:
@tensorflow/tfjs-core/dist/ops/div_no_nan.js:
@tensorflow/tfjs-core/dist/ops/dot.js:
@tensorflow/tfjs-core/dist/ops/elu.js:
@tensorflow/tfjs-core/dist/ops/max.js:
@tensorflow/tfjs-core/dist/ops/pow.js:
@tensorflow/tfjs-core/dist/ops/expand_dims.js:
@tensorflow/tfjs-core/dist/ops/tile.js:
@tensorflow/tfjs-core/dist/ops/eye.js:
@tensorflow/tfjs-core/dist/ops/greater.js:
@tensorflow/tfjs-core/dist/ops/greater_equal.js:
@tensorflow/tfjs-core/dist/ops/imag.js:
@tensorflow/tfjs-core/dist/ops/leaky_relu.js:
@tensorflow/tfjs-core/dist/ops/less.js:
@tensorflow/tfjs-core/dist/ops/less_equal.js:
@tensorflow/tfjs-core/dist/ops/local_response_normalization.js:
@tensorflow/tfjs-core/dist/ops/sub.js:
@tensorflow/tfjs-core/dist/ops/log_sum_exp.js:
@tensorflow/tfjs-core/dist/ops/logical_and.js:
@tensorflow/tfjs-core/dist/ops/logical_not.js:
@tensorflow/tfjs-core/dist/ops/logical_or.js:
@tensorflow/tfjs-core/dist/ops/logical_xor.js:
@tensorflow/tfjs-core/dist/ops/max_pool.js:
@tensorflow/tfjs-core/dist/ops/max_pool_3d.js:
@tensorflow/tfjs-core/dist/ops/maximum.js:
@tensorflow/tfjs-core/dist/ops/minimum.js:
@tensorflow/tfjs-core/dist/ops/mirror_pad.js:
@tensorflow/tfjs-core/dist/ops/mod.js:
@tensorflow/tfjs-core/dist/ops/moments.js:
@tensorflow/tfjs-core/dist/ops/multinomial.js:
@tensorflow/tfjs-core/dist/ops/not_equal.js:
@tensorflow/tfjs-core/dist/ops/one_hot.js:
@tensorflow/tfjs-core/dist/ops/pad.js:
@tensorflow/tfjs-core/dist/ops/space_to_batch_nd.js:
@tensorflow/tfjs-core/dist/ops/prelu.js:
@tensorflow/tfjs-core/dist/ops/prod.js:
@tensorflow/tfjs-core/dist/ops/rand.js:
@tensorflow/tfjs-core/dist/ops/random_gamma.js:
@tensorflow/tfjs-core/dist/ops/random_normal.js:
@tensorflow/tfjs-core/dist/ops/random_uniform.js:
@tensorflow/tfjs-core/dist/ops/real.js:
@tensorflow/tfjs-core/dist/ops/relu.js:
@tensorflow/tfjs-core/dist/ops/relu6.js:
@tensorflow/tfjs-core/dist/ops/reverse_1d.js:
@tensorflow/tfjs-core/dist/ops/reverse_2d.js:
@tensorflow/tfjs-core/dist/ops/reverse_3d.js:
@tensorflow/tfjs-core/dist/ops/reverse_4d.js:
@tensorflow/tfjs-core/dist/ops/selu.js:
@tensorflow/tfjs-core/dist/ops/spectral/fft.js:
@tensorflow/tfjs-core/dist/ops/spectral/ifft.js:
@tensorflow/tfjs-core/dist/ops/split.js:
@tensorflow/tfjs-core/dist/ops/squared_difference.js:
@tensorflow/tfjs-core/dist/ops/squeeze.js:
@tensorflow/tfjs-core/dist/ops/stack.js:
@tensorflow/tfjs-core/dist/ops/truncated_normal.js:
@tensorflow/tfjs-core/dist/ops/unique.js:
@tensorflow/tfjs-core/dist/ops/unsorted_segment_sum.js:
@tensorflow/tfjs-core/dist/ops/unstack.js:
@tensorflow/tfjs-core/dist/ops/where_async.js:
@tensorflow/tfjs-core/dist/ops/conv2d_backprop_filter.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d_native_backprop_filter.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d_native_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/image/crop_and_resize.js:
@tensorflow/tfjs-core/dist/ops/image/flip_left_right.js:
@tensorflow/tfjs-core/dist/ops/image/rotate_with_offset.js:
@tensorflow/tfjs-core/dist/ops/nonmax_util.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression.js:
@tensorflow/tfjs-core/dist/backends/non_max_suppression_impl.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_async.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_with_score.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_with_score_async.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_padded.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_padded_async.js:
@tensorflow/tfjs-core/dist/ops/image/resize_bilinear.js:
@tensorflow/tfjs-core/dist/ops/image/resize_nearest_neighbor.js:
@tensorflow/tfjs-core/dist/ops/linalg/band_part.js:
@tensorflow/tfjs-core/dist/ops/linalg/gram_schmidt.js:
@tensorflow/tfjs-core/dist/ops/linalg/qr.js:
@tensorflow/tfjs-core/dist/ops/loss_ops_utils.js:
@tensorflow/tfjs-core/dist/ops/losses/absolute_difference.js:
@tensorflow/tfjs-core/dist/ops/losses/huber_loss.js:
@tensorflow/tfjs-core/dist/ops/losses/log_loss.js:
@tensorflow/tfjs-core/dist/ops/losses/mean_squared_error.js:
@tensorflow/tfjs-core/dist/ops/losses/sigmoid_cross_entropy.js:
@tensorflow/tfjs-core/dist/ops/losses/softmax_cross_entropy.js:
@tensorflow/tfjs-core/dist/ops/ops.js:
@tensorflow/tfjs-core/dist/ops/rotate_util.js:
@tensorflow/tfjs-core/dist/backends/kernel_impls.js:
@tensorflow/tfjs-backend-cpu/dist/utils/binary_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Complex.js:
@tensorflow/tfjs-backend-cpu/dist/utils/zeros_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Identity.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Real.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cast.js:
@tensorflow/tfjs-backend-cpu/dist/utils/binary_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Add.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Bincount_impl.js:
@tensorflow/tfjs-backend-cpu/dist/utils/unary_impl.js:
@tensorflow/tfjs-backend-cpu/dist/utils/unary_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Concat_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Equal.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FloorDiv.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherV2_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Greater.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GreaterEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Less.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LessEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LinSpace_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Max_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Maximum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Minimum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Multiply.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Neg.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/NotEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Transpose_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Transpose.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Prod.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Range_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Scatter_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Slice.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SquaredDifference.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StridedSlice_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sub.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/TopK_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Unique_impl.js:
@tensorflow/tfjs-backend-cpu/dist/shared.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/shared.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Identity.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Complex.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LeakyRelu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Prelu.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/kernel_funcs_utils.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Multiply.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/reshape.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reshape.js:
@tensorflow/tfjs-backend-webgl/dist/mean_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/reduce.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transpose_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sum_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transpose.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchMatMul_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Abs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Acos.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Acosh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Add.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AddN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/All.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Any.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/arg_min_max.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ArgMax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ArgMin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Asin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Asinh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atan.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atan2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atanh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool3DGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPoolGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchMatMul.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchNorm.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Slice.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchToSpaceND.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Bincount.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NotEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Real.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/int.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cast.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Ceil.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ClipByValue.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ComplexAbs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Imag.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Concat_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Concat.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2D_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2DBackpropFilter.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2DBackpropInput.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3DBackpropFilterV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3DBackpropInputV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cos.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cosh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/CropAndResize.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DenseBincount.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthToSpace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNative.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNativeBackpropFilter.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNativeBackpropInput.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Diag.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Dilation2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Elu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/EluGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Equal.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Erf.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Exp.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Expm1.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FFT_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FFT.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Fill.js:
@tensorflow/tfjs-backend-webgl/dist/flip_left_right_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FlipLeftRight.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Floor.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FloorDiv.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FusedConv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FusedDepthwiseConv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GatherNd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GatherV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Greater.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GreaterEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IFFT.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsFinite.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsInf.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsNaN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Less.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LessEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LinSpace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Log.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Log1p.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalAnd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalNot.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalOr.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LRN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LRNGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Max_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Max.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Maximum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool3DGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolWithArgmax_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolWithArgmax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mean_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mean.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Min.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Minimum.js:
@tensorflow/tfjs-backend-webgl/dist/mirror_pad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/mirror_pad_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MirrorPad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RealDiv.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sub.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Softmax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Multinomial.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Neg.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV3.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV4.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV5.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/OneHot.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ZerosLike.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/OnesLike.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Pack.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/PadV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Pow.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Prod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Range.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reciprocal.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Relu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Relu6.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeBilinear.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeBilinearGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeNearestNeighbor.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeNearestNeighborGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reverse.js:
@tensorflow/tfjs-backend-webgl/dist/rotate_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RotateWithOffset.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Round.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Rsqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ScatterNd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Select.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Selu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sigmoid.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sign.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sinh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Softplus.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SpaceToBatchND.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseToDense.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SplitV.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SquaredDifference.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Step.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StridedSlice.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tan.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tanh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tile.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/TopK.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Unpack.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/UnsortedSegmentSum.js:
@tensorflow/tfjs-backend-webgl/dist/register_all_kernels.js:
@tensorflow/tfjs-backend-webgl/dist/index.js:
@tensorflow/tfjs-backend-cpu/dist/base.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LeakyRelu.js:
@tensorflow/tfjs-backend-cpu/dist/utils/fused_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Reshape.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/AddN.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/All.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Any.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ArgMax.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ArgMin.js:
@tensorflow/tfjs-backend-cpu/dist/utils/pool_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/AvgPool.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/AvgPool3D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/AvgPool3DGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/AvgPoolGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BatchNorm.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BatchToSpaceND.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Bincount.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Imag.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Concat.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv2D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv2DBackpropFilter.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv2DBackpropInput.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv3D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv3DBackpropFilterV2.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Conv3DBackpropInputV2.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cos.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/CropAndResize.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cumsum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/DenseBincount.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/DepthToSpace.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/DepthwiseConv2dNative.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/DepthwiseConv2dNativeBackpropFilter.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/DepthwiseConv2dNativeBackpropInput.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Diag.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Dilation2D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Dilation2DBackpropFilter.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Dilation2DBackpropInput.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/EluGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ExpandDims.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RealDiv.js:
@tensorflow/tfjs-backend-cpu/dist/utils/fft_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FFT.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Fill.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FlipLeftRight.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FusedConv2D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FusedDepthwiseConv2D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherNd.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherV2.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/IFFT.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LinSpace.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LogicalAnd.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LogicalOr.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LRN.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LRNGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Max.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPool.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPool3D.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPool3DGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPoolGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPoolWithArgmax_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MaxPoolWithArgmax.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Mean.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Min.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/MirrorPad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Mod.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Softmax.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Multinomial.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/NonMaxSuppressionV3.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/NonMaxSuppressionV4.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/OneHot.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ZerosLike.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/OnesLike.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Pack.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/PadV2.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Pow.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Range.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ResizeBilinear.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ResizeBilinearGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ResizeNearestNeighbor.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ResizeNearestNeighborGrad.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Reverse.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RotateWithOffset.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ScatterNd.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Select.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SpaceToBatchND.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseToDense.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SplitV.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StridedSlice.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Tile.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/TopK.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Unpack.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/UnsortedSegmentSum.js:
@tensorflow/tfjs-backend-cpu/dist/register_all_kernels.js:
@tensorflow/tfjs-backend-cpu/dist/index.js:
@tensorflow/tfjs-core/dist/ops/ops_for_converter.js:
@tensorflow/tfjs-converter/dist/executor/tensor_utils.js:
@tensorflow/tfjs-converter/dist/executor/tensor_list.js:
@tensorflow/tfjs-converter/dist/executor/hash_table.js:
@tensorflow/tfjs-converter/dist/operations/executors/hash_table_executor.js:
  (**
   * @license
   * Copyright 2020 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/environment.js:
@tensorflow/tfjs-core/dist/util.js:
@tensorflow/tfjs-core/dist/tape.js:
@tensorflow/tfjs-core/dist/tensor.js:
@tensorflow/tfjs-core/dist/types.js:
@tensorflow/tfjs-core/dist/device_util.js:
@tensorflow/tfjs-core/dist/ops/broadcast_util.js:
@tensorflow/tfjs-core/dist/ops/axis_util.js:
@tensorflow/tfjs-core/dist/browser_util.js:
@tensorflow/tfjs-core/dist/ops/concat_util.js:
@tensorflow/tfjs-core/dist/ops/reduce_util.js:
@tensorflow/tfjs-core/dist/index.js:
@tensorflow/tfjs-backend-webgl/dist/tex_util.js:
@tensorflow/tfjs-backend-webgl/dist/webgl_util.js:
@tensorflow/tfjs-backend-webgl/dist/shader_compiler.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_math.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_util.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_context.js:
@tensorflow/tfjs-backend-webgl/dist/texture_manager.js:
@tensorflow/tfjs-backend-webgl/dist/unaryop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/backend_webgl.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reduce_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/transpose_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/argminmax_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pool_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/avg_pool_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/batchnorm_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/slice_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/clip_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/concat_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/crop_and_resize_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/dilation_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/gather_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/max_pool_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/multinomial_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/onehot_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reverse_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/select_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/strided_slice_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/tile_gpu.js:
  (**
   * @license
   * Copyright 2017 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/log.js:
@tensorflow/tfjs-core/dist/profiler.js:
@tensorflow/tfjs-core/dist/tensor_format.js:
@tensorflow/tfjs-core/dist/tensor_util.js:
@tensorflow/tfjs-core/dist/engine.js:
@tensorflow/tfjs-core/dist/tensor_util_env.js:
@tensorflow/tfjs-core/dist/ops/operation.js:
@tensorflow/tfjs-core/dist/ops/tensor_ops_util.js:
@tensorflow/tfjs-core/dist/ops/tensor.js:
@tensorflow/tfjs-core/dist/io/types.js:
@tensorflow/tfjs-core/dist/globals.js:
@tensorflow/tfjs-core/dist/io/io_utils.js:
@tensorflow/tfjs-core/dist/io/router_registry.js:
@tensorflow/tfjs-core/dist/io/indexed_db.js:
@tensorflow/tfjs-core/dist/io/local_storage.js:
@tensorflow/tfjs-core/dist/io/model_management.js:
@tensorflow/tfjs-core/dist/ops/abs.js:
@tensorflow/tfjs-core/dist/ops/acos.js:
@tensorflow/tfjs-core/dist/ops/acosh.js:
@tensorflow/tfjs-core/dist/ops/asin.js:
@tensorflow/tfjs-core/dist/ops/asinh.js:
@tensorflow/tfjs-core/dist/ops/atan.js:
@tensorflow/tfjs-core/dist/ops/atanh.js:
@tensorflow/tfjs-core/dist/ops/sigmoid.js:
@tensorflow/tfjs-core/dist/ops/slice.js:
@tensorflow/tfjs-core/dist/ops/tanh.js:
@tensorflow/tfjs-core/dist/ops/ceil.js:
@tensorflow/tfjs-core/dist/ops/clip_by_value.js:
@tensorflow/tfjs-core/dist/ops/cos.js:
@tensorflow/tfjs-core/dist/ops/cosh.js:
@tensorflow/tfjs-core/dist/ops/cumsum.js:
@tensorflow/tfjs-core/dist/ops/zeros_like.js:
@tensorflow/tfjs-core/dist/ops/erf.js:
@tensorflow/tfjs-core/dist/ops/scalar.js:
@tensorflow/tfjs-core/dist/ops/sqrt.js:
@tensorflow/tfjs-core/dist/ops/sum.js:
@tensorflow/tfjs-core/dist/ops/norm.js:
@tensorflow/tfjs-core/dist/ops/exp.js:
@tensorflow/tfjs-core/dist/ops/expm1.js:
@tensorflow/tfjs-core/dist/ops/floor.js:
@tensorflow/tfjs-core/dist/ops/gather.js:
@tensorflow/tfjs-core/dist/ops/is_finite.js:
@tensorflow/tfjs-core/dist/ops/is_inf.js:
@tensorflow/tfjs-core/dist/ops/is_nan.js:
@tensorflow/tfjs-core/dist/ops/linspace.js:
@tensorflow/tfjs-core/dist/ops/log.js:
@tensorflow/tfjs-core/dist/ops/log1p.js:
@tensorflow/tfjs-core/dist/gradients.js:
@tensorflow/tfjs-core/dist/ops/neg.js:
@tensorflow/tfjs-core/dist/ops/softplus.js:
@tensorflow/tfjs-core/dist/ops/log_sigmoid.js:
@tensorflow/tfjs-core/dist/ops/max_pool_with_argmax.js:
@tensorflow/tfjs-core/dist/ops/zeros.js:
@tensorflow/tfjs-core/dist/ops/ones.js:
@tensorflow/tfjs-core/dist/ops/ones_like.js:
@tensorflow/tfjs-core/dist/ops/pool.js:
@tensorflow/tfjs-core/dist/ops/rand_util.js:
@tensorflow/tfjs-core/dist/ops/range.js:
@tensorflow/tfjs-core/dist/ops/reciprocal.js:
@tensorflow/tfjs-core/dist/ops/reverse.js:
@tensorflow/tfjs-core/dist/ops/round.js:
@tensorflow/tfjs-core/dist/ops/rsqrt.js:
@tensorflow/tfjs-core/dist/ops/sign.js:
@tensorflow/tfjs-core/dist/ops/sin.js:
@tensorflow/tfjs-core/dist/ops/sinh.js:
@tensorflow/tfjs-core/dist/ops/slice1d.js:
@tensorflow/tfjs-core/dist/ops/slice2d.js:
@tensorflow/tfjs-core/dist/ops/slice3d.js:
@tensorflow/tfjs-core/dist/ops/slice4d.js:
@tensorflow/tfjs-core/dist/ops/softmax.js:
@tensorflow/tfjs-core/dist/ops/spectral/irfft.js:
@tensorflow/tfjs-core/dist/ops/spectral/rfft.js:
@tensorflow/tfjs-core/dist/ops/step.js:
@tensorflow/tfjs-core/dist/ops/strided_slice.js:
@tensorflow/tfjs-core/dist/ops/tan.js:
@tensorflow/tfjs-core/dist/ops/tensor1d.js:
@tensorflow/tfjs-core/dist/ops/tensor2d.js:
@tensorflow/tfjs-core/dist/ops/tensor3d.js:
@tensorflow/tfjs-core/dist/ops/tensor4d.js:
@tensorflow/tfjs-core/dist/ops/tensor5d.js:
@tensorflow/tfjs-core/dist/ops/tensor6d.js:
@tensorflow/tfjs-core/dist/ops/topk.js:
@tensorflow/tfjs-core/dist/ops/variable.js:
@tensorflow/tfjs-core/dist/backends/where_impl.js:
@tensorflow/tfjs-core/dist/ops/boolean_mask.js:
@tensorflow/tfjs-core/dist/ops/transpose.js:
@tensorflow/tfjs-core/dist/ops/moving_average.js:
@tensorflow/tfjs-core/dist/ops/scatter_nd.js:
@tensorflow/tfjs-core/dist/ops/sparse_to_dense.js:
@tensorflow/tfjs-core/dist/ops/gather_nd.js:
@tensorflow/tfjs-core/dist/ops/dropout.js:
@tensorflow/tfjs-core/dist/serialization.js:
@tensorflow/tfjs-core/dist/optimizers/optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adadelta_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adagrad_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adam_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adamax_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/sgd_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/momentum_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/rmsprop_optimizer.js:
@tensorflow/tfjs-core/dist/io/browser_files.js:
@tensorflow/tfjs-core/dist/io/weights_loader.js:
@tensorflow/tfjs-core/dist/io/http.js:
@tensorflow/tfjs-core/dist/io/passthrough.js:
@tensorflow/tfjs-core/dist/io/io.js:
@tensorflow/tfjs-core/dist/train.js:
@tensorflow/tfjs-core/dist/ops/array_ops_util.js:
@tensorflow/tfjs-core/dist/ops/selu_util.js:
@tensorflow/tfjs-core/dist/ops/erf_util.js:
@tensorflow/tfjs-core/dist/backends/complex_util.js:
@tensorflow/tfjs-core/dist/ops/segment_util.js:
@tensorflow/tfjs-core/dist/backends/backend_util.js:
@tensorflow/tfjs-backend-webgl/dist/canvas_util.js:
@tensorflow/tfjs-backend-webgl/dist/glsl_version.js:
@tensorflow/tfjs-backend-webgl/dist/shader_compiler_util.js:
@tensorflow/tfjs-backend-webgl/dist/encode_float_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_float_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_matrix_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_matrix_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/packing_util.js:
@tensorflow/tfjs-backend-webgl/dist/pack_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reshape_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/unaryop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/unpack_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/mulmat_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_complex_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/batchnorm_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/clip_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/complex_abs_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/depth_to_space_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_packed_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/fft_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels_utils/from_pixels_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels_utils/from_pixels_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_grad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/scatter_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/segment_gpu.js:
@tensorflow/tfjs-converter/dist/operations/executors/utils.js:
@tensorflow/tfjs-converter/dist/operations/operation_mapper.js:
@tensorflow/tfjs-converter/dist/operations/executors/arithmetic_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/basic_math_executor.js:
@tensorflow/tfjs-converter/dist/executor/tensor_array.js:
@tensorflow/tfjs-converter/dist/operations/executors/control_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/convolution_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/creation_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/dynamic_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/evaluation_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/graph_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/image_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/logical_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/matrices_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/normalization_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/reduction_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/slice_join_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/spectral_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/transformation_executor.js:
@tensorflow/tfjs-converter/dist/operations/operation_executor.js:
@tensorflow/tfjs-converter/dist/executor/graph_executor.js:
@tensorflow/tfjs-converter/dist/executor/graph_model.js:
@tensorflow/tfjs-converter/dist/index.js:
  (**
   * @license
   * Copyright 2018 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/kernel_registry.js:
@tensorflow/tfjs-core/dist/flags.js:
@tensorflow/tfjs-core/dist/platforms/platform_browser.js:
@tensorflow/tfjs-core/dist/platforms/platform_node.js:
@tensorflow/tfjs-core/dist/ops/square.js:
@tensorflow/tfjs-core/dist/ops/dropout_util.js:
@tensorflow/tfjs-core/dist/ops/signal_ops_util.js:
@tensorflow/tfjs-core/dist/ops/in_top_k.js:
@tensorflow/tfjs-core/dist/ops/fused_util.js:
@tensorflow/tfjs-core/dist/ops/fused/conv2d.js:
@tensorflow/tfjs-core/dist/ops/fused/depthwise_conv2d.js:
@tensorflow/tfjs-core/dist/ops/fused/mat_mul.js:
@tensorflow/tfjs-core/dist/ops/fused_ops.js:
@tensorflow/tfjs-core/dist/ops/signal/hamming_window.js:
@tensorflow/tfjs-core/dist/ops/signal/hann_window.js:
@tensorflow/tfjs-core/dist/ops/signal/frame.js:
@tensorflow/tfjs-core/dist/ops/signal/stft.js:
@tensorflow/tfjs-core/dist/backends/non_max_suppression_util.js:
@tensorflow/tfjs-core/dist/io/progress.js:
@tensorflow/tfjs-core/dist/ops/browser.js:
@tensorflow/tfjs-backend-webgl/dist/flags_webgl.js:
@tensorflow/tfjs-backend-webgl/dist/decode_matrix_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/decode_matrix_packed_gpu.js:
@tensorflow/tfjs-backend-cpu/dist/cpu_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Tile_impl.js:
@tensorflow/tfjs-backend-webgl/dist/webgl.js:
@tensorflow/tfjs-backend-webgl/dist/transpose_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/addn_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/addn_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/argminmax_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/slice_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/concat_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/im2col_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/diag_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/fill_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pad_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reverse_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Square.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/NonMaxSuppressionV5.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Square.js:
@tensorflow/tfjs-converter/dist/operations/custom_op/register.js:
@tensorflow/tfjs-converter/dist/operations/custom_op/node_value_impl.js:
@tensorflow/tfjs-converter/dist/executor/model_analysis.js:
  (**
   * @license
   * Copyright 2019 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/platforms/is_typed_array_browser.js:
@tensorflow/tfjs-core/dist/ops/bitwise_and.js:
@tensorflow/tfjs-core/dist/ops/ensure_shape.js:
@tensorflow/tfjs-core/dist/ops/random_uniform_int.js:
@tensorflow/tfjs-core/dist/ops/image/rgb_to_grayscale.js:
@tensorflow/tfjs-core/dist/ops/string/static_regex_replace.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BitwiseAnd.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StaticRegexReplace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BitwiseAnd.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/scatter_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StaticRegexReplace.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Draw.js:
  (**
   * @license
   * Copyright 2023 Google LLC.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/hash_util.js:
@tensorflow/tfjs-core/dist/ops/broadcast_args.js:
@tensorflow/tfjs-core/dist/ops/einsum.js:
@tensorflow/tfjs-core/dist/ops/meshgrid.js:
@tensorflow/tfjs-core/dist/ops/image/grayscale_to_rgb.js:
@tensorflow/tfjs-core/dist/ops/image/transform.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_fill_empty_rows.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_reshape.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_mean.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_sum.js:
@tensorflow/tfjs-core/dist/ops/string/string_n_grams.js:
@tensorflow/tfjs-core/dist/ops/string/string_split.js:
@tensorflow/tfjs-core/dist/ops/string/string_to_hash_bucket_fast.js:
@tensorflow/tfjs-core/dist/ops/slice_util.js:
@tensorflow/tfjs-core/dist/backends/einsum_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_fill_empty_rows_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_reshape_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_reduction_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherNd_Impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseFillEmptyRows_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseReshape_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseSegmentReduction_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringNGrams_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringSplit_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringToHashBucketFast_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BroadcastArgs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Einsum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseFillEmptyRows.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseReshape.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseSegmentMean.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseSegmentSum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringNGrams.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringSplit.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringToHashBucketFast.js:
@tensorflow/tfjs-backend-webgl/dist/transform_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transform.js:
@tensorflow/tfjs-backend-cpu/dist/backend_cpu.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BroadcastArgs.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Einsum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseFillEmptyRows.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseReshape.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseSegmentMean.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseSegmentSum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringNGrams.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringSplit.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringToHashBucketFast.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Transform.js:
@tensorflow/tfjs-converter/dist/flags.js:
@tensorflow/tfjs-converter/dist/operations/executors/sparse_executor.js:
@tensorflow/tfjs-converter/dist/operations/executors/string_executor.js:
  (**
   * @license
   * Copyright 2021 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/buffer.js:
@tensorflow/tfjs-core/dist/ops/cast.js:
@tensorflow/tfjs-core/dist/ops/print.js:
@tensorflow/tfjs-core/dist/base_side_effects.js:
@tensorflow/tfjs-core/dist/ops/arg_max.js:
@tensorflow/tfjs-core/dist/ops/arg_min.js:
@tensorflow/tfjs-core/dist/ops/min.js:
@tensorflow/tfjs-core/dist/ops/log_softmax.js:
@tensorflow/tfjs-core/dist/ops/mean.js:
@tensorflow/tfjs-core/dist/ops/setdiff1d_async.js:
@tensorflow/tfjs-core/dist/ops/fused_types.js:
@tensorflow/tfjs-core/dist/base.js:
@tensorflow/tfjs-backend-webgl/dist/base.js:
  (**
   * @license
   * Copyright 2020 Google Inc. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/cumprod.js:
  (**
   * @license
   * Copyright 2022 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the 'License');
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an 'AS IS' BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/euclidean_norm.js:
@tensorflow/tfjs-core/dist/ops/search_sorted.js:
@tensorflow/tfjs-core/dist/ops/lower_bound.js:
@tensorflow/tfjs-core/dist/ops/ragged_gather.js:
@tensorflow/tfjs-core/dist/ops/ragged_tensor_to_tensor.js:
@tensorflow/tfjs-core/dist/ops/random_standard_normal.js:
@tensorflow/tfjs-core/dist/ops/tensor_scatter_update.js:
@tensorflow/tfjs-core/dist/ops/upper_bound.js:
@tensorflow/tfjs-core/dist/ops/ragged_to_dense_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedGather_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedTensorToTensor_impl.js:
@tensorflow/tfjs-backend-webgl/dist/conv_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cum_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cumprod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cumsum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedGather.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedTensorToTensor.js:
@tensorflow/tfjs-backend-webgl/dist/search_sorted_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SearchSorted.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/TensorScatterUpdate.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cumprod.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedGather.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedTensorToTensor.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SearchSorted_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SearchSorted.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/TensorScatterUpdate.js:
@tensorflow/tfjs-converter/dist/operations/executors/ragged_executor.js:
  (**
   * @license
   * Copyright 2022 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/ragged_range.js:
@tensorflow/tfjs-core/dist/optimizers/register_optimizers.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedRange_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedRange.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedRange.js:
  (**
   * @license
   * Copyright 2022 Google LLC.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/image/threshold.js:
  (**
   * @license
   * Copyright 2021 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * https://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-backend-cpu/dist/kernels/Abs.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Ceil.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Exp.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Expm1.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Floor.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Log.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Rsqrt.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sigmoid.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/_FusedMatMul.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ExpandDims.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Unique.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Elu.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Prelu.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Relu.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Relu6.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BatchMatMul.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/_FusedMatMul.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Acos.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Acosh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Asin.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Asinh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Atan.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Atan2.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Atanh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ClipByValue.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/ComplexAbs.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cosh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Erf.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/IsFinite.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/IsInf.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/IsNaN.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Log1p.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LogicalNot.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Reciprocal.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Round.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Selu.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sign.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sin.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sinh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Softplus.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Step.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Tan.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Tanh.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Unique.js:
  (**
   * @license
   * Copyright 2020 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the License);
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an AS IS BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-converter/dist/data/compiled_api.js:
  (**
   * @license
   * Copyright 2019 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * =============================================================================
   *)

@tensorflow/tfjs-converter/dist/operations/op_list/arithmetic.js:
@tensorflow/tfjs-converter/dist/operations/op_list/basic_math.js:
@tensorflow/tfjs-converter/dist/operations/op_list/control.js:
@tensorflow/tfjs-converter/dist/operations/op_list/convolution.js:
@tensorflow/tfjs-converter/dist/operations/op_list/creation.js:
@tensorflow/tfjs-converter/dist/operations/op_list/dynamic.js:
@tensorflow/tfjs-converter/dist/operations/op_list/evaluation.js:
@tensorflow/tfjs-converter/dist/operations/op_list/graph.js:
@tensorflow/tfjs-converter/dist/operations/op_list/hash_table.js:
@tensorflow/tfjs-converter/dist/operations/op_list/image.js:
@tensorflow/tfjs-converter/dist/operations/op_list/logical.js:
@tensorflow/tfjs-converter/dist/operations/op_list/matrices.js:
@tensorflow/tfjs-converter/dist/operations/op_list/normalization.js:
@tensorflow/tfjs-converter/dist/operations/op_list/reduction.js:
@tensorflow/tfjs-converter/dist/operations/op_list/slice_join.js:
@tensorflow/tfjs-converter/dist/operations/op_list/sparse.js:
@tensorflow/tfjs-converter/dist/operations/op_list/spectral.js:
@tensorflow/tfjs-converter/dist/operations/op_list/string.js:
@tensorflow/tfjs-converter/dist/operations/op_list/transformation.js:
  (**
   * @license
   * Copyright 2023 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-converter/dist/version.js:
  (** @license See the LICENSE file. *)
*/
