(function(){try{var e=typeof globalThis<`u`?globalThis:typeof window<`u`?window:typeof global<`u`?global:typeof self<`u`?self:{},t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[t]=`520571c1-c072-49df-8145-a559ce9406b2`,e._sentryDebugIdIdentifier=`sentry-dbid-520571c1-c072-49df-8145-a559ce9406b2`)}catch{}})();import{Ct as e}from"./Eh49J82T.js";import{Dt as t,Ft as n,St as r,Ut as i,Xt as a,Yt as o,an as s,cn as c,qt as l,tn as u}from"./BOmpkGNl.js";import{J as d,L as f,et as p,nt as m,rt as h}from"./DpMrDo4h.js";import{Bn as g,Bt as _,Dr as v,Ga as y,Ha as b,K as x,Ka as S,N as C,Nn as ee,Nr as te,P as w,Pn as ne,Pt as re,Rr as ie,Rt as ae,Wa as oe,Xt as se,Yn as ce,ao as le,cr as ue,dn as de,fn as fe,ha as pe,ir as T,k as E,oo as D,pn as me,qr as he,sr as O,ta as ge,w as _e,zi as ve,zn as ye}from"./BeRoCCla.js";var k=Symbol.for(`koota.internal`),be=4,xe=8,Se=20,Ce=(1<<be)-1,we=(1<<xe)-1,A=(1<<Se)-1,Te=Se,j=Te+xe;function Ee(e,t,n){return(e&Ce)<<j|(t&we)<<Te|n&A}var De=e=>e&~(we<<Te)|((e>>>Te&we)+1&we)<<Te;function Oe(e,t){return e===t||typeof e==`object`&&!!e&&typeof t==`object`&&!!t&&(()=>{let n=Object.keys(e),r=Object.keys(t);return n.length===r.length&&n.every(n=>Object.hasOwn(t,n)&&e[n]===t[n])})()}var M=Symbol.for(`relationPair`),ke=Symbol.for(`relation`),Ae=Symbol.for(`orderedTargetsTrait`);function je(){return{worldCursor:0,releasedWorldIds:[],maxWorlds:2**be}}function Me(e){if(e.releasedWorldIds.length>0)return e.releasedWorldIds.pop();if(e.worldCursor>=e.maxWorlds)throw Error(`Koota: Too many worlds created. The maximum is ${e.maxWorlds}.`);return e.worldCursor++}function Ne(e,t){if(t<0||t>=e.maxWorlds)throw Error(`Invalid world ID: ${t}`);t===e.worldCursor-1?e.worldCursor--:t<e.worldCursor&&!e.releasedWorldIds.includes(t)&&e.releasedWorldIds.push(t)}var N={worlds:[],cachedQueries:new Map,worldIndex:je(),reset:()=>{N.worlds=[],N.cachedQueries=new Map,N.worldIndex=je()}},Pe=Symbol(`modifier`);function Fe(e,t,n){return{[Pe]:!0,type:e,id:t,traits:n,traitIds:n.map(e=>e.id)}}function Ie(e){let{type:t}=e;return t.includes(`added`)||t.includes(`removed`)||t.includes(`changed`)}function Le(e){let{type:t}=e;return t.includes(`added`)?`add`:t.includes(`removed`)?`remove`:t.includes(`changed`)?`change`:null}function Re(e){return e.type===`or`&&Array.isArray(e.modifiers)}var ze=3;function Be(){return ze}function Ve(e,t){let n=e[k],r=structuredClone(n.entityMasks);n.trackingSnapshots.set(t,r),n.dirtyMasks.set(t,r.map(e=>e.map(()=>0))),n.changedMasks.set(t,r.map(e=>e.map(()=>0)))}var He=Symbol.for(`queryRef`);function Ue(e,t,n){let r=t.staticBitmasks,i=t.generations,a=e[k],o=n&A;if(t.traitInstances.all.length===0)return!1;for(let e=0;e<i.length;e++){let t=i[e],n=r[e];if(!n)continue;let s=n.required,c=n.forbidden,l=n.or,u=a.entityMasks[t]?.[o]||0;if(!c&&!s&&!l||c&&(u&c)!==0||s&&(u&s)!==s||l!==0&&(u&l)===0)return!1}return!0}function We(e,t,n){if(!Ue(e,t,n))return!1;if(t.relationFilters&&t.relationFilters.length>0)for(let r of t.relationFilters){if(r.targetQueryMatches){if(!Nt(e,r.relation,n,r.targetQueryMatches))return!1;continue}if(!Lt(e,n,r))return!1}return!0}function Ge(e,t,n,r,i,a){let o=t.staticBitmasks,s=t.trackingGroups,c=t.generations,l=t.traitInstances.all,u=e[k].entityMasks,d=n&A,f=c.length,p=s.length;if(l.length===0)return!1;for(let e=0;e<f;e++){let t=c[e],n=o[e];if(!n)continue;let r=n.required,i=n.forbidden,a=n.or,s=u[t],l=s?s[d]|0:0;if(i&&(l&i)!==0||r&&(l&r)!==r||a!==0&&(l&a)===0)return!1}let m=!1,h=!1;for(let e=0;e<p;e++){let t=s[e],n=t.type,o=t.logic,c=t.bitmasks,l=c[i];if(l&&l&a){if(r===`remove`){if(n===`add`||n===`change`)return!1}else if(r===`add`&&(n===`remove`||n===`change`))return!1;if(n===r){if(r===`change`){let e=u[i];if(!((e?e[d]|0:0)&a))return!1}let e=t.trackers,n=e[i];n||(n=[],e[i]=n),n[d]=n[d]|0|a}}if(o===`or`){if(m=!0,!h){let e=t.trackers,n=c.length;for(let t=0;t<n;t++){let n=c[t];if(!n)continue;let r=e[t];if((r?r[d]|0:0)&n){h=!0;break}}}}else{let e=t.trackers,n=c.length;for(let t=0;t<n;t++){let n=c[t];if(!n)continue;let r=e[t];if(((r?r[d]|0:0)&n)!==n)return!1}}}return!(m&&!h)}function Ke(e,t,n,r,i,a){if(!Ge(e,t,n,r,i,a))return!1;if(t.relationFilters&&t.relationFilters.length>0)for(let r of t.relationFilters){if(r.targetQueryMatches){if(!Nt(e,r.relation,n,r.targetQueryMatches))return!1;continue}if(!Lt(e,n,r))return!1}return!0}function P(e,t,n){let r,i=e[k];if(!_t(e,t,n))r=void 0;else{let a=n.id;a<i.traitInstances.length&&i.traitInstances[a]!==void 0||I(e,n);let o=i.traitInstances[n.id],s=t&A,{generationId:c,bitflag:l}=o;for(let e of i.changedMasks.values())e[c]||(e[c]=[]),e[c][s]||(e[c][s]=0),e[c][s]|=l;for(let r of o.trackingQueries)r.hasChangedModifiers&&r.changedTraits.has(n)&&((r.relationFilters&&r.relationFilters.length>0?Ke(e,r,t,`change`,c,l):r.checkTracking(e,t,`change`,c,l))?r.add(t):r.remove(e,t));r=o}let a=r;if(a)for(let e of a.changeSubscriptions)e(t)}function qe(e,t,n,r){let i,a=e[k];if(!_t(e,t,n))i=void 0;else{let r=n.id;r<a.traitInstances.length&&a.traitInstances[r]!==void 0||I(e,n);let o=a.traitInstances[n.id],s=t&A,{generationId:c,bitflag:l}=o;for(let e of a.changedMasks.values())e[c]||(e[c]=[]),e[c][s]||(e[c][s]=0),e[c][s]|=l;for(let r of o.trackingQueries)r.hasChangedModifiers&&r.changedTraits.has(n)&&((r.relationFilters&&r.relationFilters.length>0?Ke(e,r,t,`change`,c,l):r.checkTracking(e,t,`change`,c,l))?r.add(t):r.remove(e,t));i=o}let o=i;if(o)for(let e of o.changeSubscriptions)e(t,r)}function Je(e,t){let n=e[k],r=t[Ae].relation[k].trait,i=n.traitInstances[t.id];if(!i)return;let a=n.traitInstances[r.id];a||=(I(e,r),n.traitInstances[r.id]);let{generationId:o,bitflag:s,store:c}=i,{entityMasks:l,entityIndex:u}=n,d=t[k],f=e=>{let t=e&A;return l[o]?.[t]&s?d.get(t,c):void 0};a.addSubscriptions.add((e,t)=>{f(t)?._appendWithoutSync(e)}),a.removeSubscriptions.add((e,t)=>{let n=t&A,r=u.sparse[n];r!==void 0&&(u.dense[r]&A)===n&&f(t)?._removeWithoutSync(e)})}var Ye=class extends Array{world;parent;relation;orderedTrait;_syncing=!1;constructor(e,t,n,r,i=[]){super(...i),this.world=e,this.parent=t,this.relation=n,this.orderedTrait=r}get[Symbol.toStringTag](){return`OrderedList`}push(...e){this._syncing=!0;try{for(let t of e)mt(this.world,t,this.relation(this.parent));let t=super.push(...e);return P(this.world,this.parent,this.orderedTrait),t}finally{this._syncing=!1}}pop(){this._syncing=!0;try{let e=super.pop();return e!==void 0&&(ht(this.world,e,this.relation(this.parent)),P(this.world,this.parent,this.orderedTrait)),e}finally{this._syncing=!1}}shift(){this._syncing=!0;try{let e=super.shift();return e!==void 0&&(ht(this.world,e,this.relation(this.parent)),P(this.world,this.parent,this.orderedTrait)),e}finally{this._syncing=!1}}unshift(...e){this._syncing=!0;try{for(let t of e)mt(this.world,t,this.relation(this.parent));let t=super.unshift(...e);return P(this.world,this.parent,this.orderedTrait),t}finally{this._syncing=!1}}splice(e,t,...n){this._syncing=!0;try{let r=super.splice(e,t??0,...n);for(let e of r)ht(this.world,e,this.relation(this.parent));for(let e of n)mt(this.world,e,this.relation(this.parent));return(r.length>0||n.length>0)&&P(this.world,this.parent,this.orderedTrait),r}finally{this._syncing=!1}}sort(e){return super.sort(e),P(this.world,this.parent,this.orderedTrait),this}reverse(){return super.reverse(),P(this.world,this.parent,this.orderedTrait),this}map(e){return Array.prototype.map.call(this,e)}filter(e){return Array.prototype.filter.call(this,e)}slice(e,t){return Array.prototype.slice.call(this,e,t)}moveTo(e,t){let n=this.indexOf(e);if(n===-1)throw Error(`Item not found in OrderedList`);n!==t&&(super.splice(n,1),super.splice(t,0,e),P(this.world,this.parent,this.orderedTrait))}insert(e,t){this._syncing=!0;try{mt(this.world,e,this.relation(this.parent)),super.splice(t,0,e),P(this.world,this.parent,this.orderedTrait)}finally{this._syncing=!1}}_appendWithoutSync(e){this._syncing||(super.push(e),P(this.world,this.parent,this.orderedTrait))}_removeWithoutSync(e){if(!this._syncing){let t=this.indexOf(e);t!==-1&&(super.splice(t,1),P(this.world,this.parent,this.orderedTrait))}}};function Xe(e){if(typeof e==`function`)return[];{let t={};for(let n in e)t[n]=[];return t}}function Ze(e){let t=Object.keys(e).map(e=>`if ('${e}' in value) store.${e}[index] = value.${e};`).join(`
    `);return Function(`index`,`store`,`value`,`
		${t}
	  `)}function Qe(e){let t=Object.keys(e).map(e=>`store.${e}[index] = value.${e};`).join(`
    `);return Function(`index`,`store`,`value`,`
		${t}
	  `)}function $e(e){let t=Object.keys(e).map(e=>`if (store.${e}[index] !== value.${e}) {
            store.${e}[index] = value.${e};
            changed = true;
        }`).join(`
    `);return Function(`index`,`store`,`value`,`
        let changed = false;
        ${t}
        return changed;
        `)}function et(e){let t=`{ ${Object.keys(e).map(e=>`${e}: store.${e}[index]`).join(`, `)} }`;return Function(`index`,`store`,`
        return ${t};
        `)}function tt(e){return(e,t,n)=>{t[e]=n}}function nt(e){return(e,t,n)=>{let r=!1;return n!==t[e]&&(t[e]=n,r=!0),r}}function rt(e){return(e,t)=>t[e]}var it=()=>{},at=()=>it,ot={soa:Ze,aos:tt,tag:at},st={soa:Qe,aos:tt,tag:at},ct={soa:$e,aos:nt,tag:at},lt={soa:et,aos:rt,tag:at},ut=Object.freeze({}),dt=0;function ft(e=ut){let t=typeof e==`function`,n=!t&&Object.keys(e).length===0,r=t?`aos`:n?`tag`:`soa`;for(let t in e){let n=e[t];if(typeof n==`object`&&n)throw Error(`Koota: ${t} is an ${Array.isArray(n)?`array`:`object`}, which is not supported in traits.`)}let i=dt++,a=Object.assign(e=>[a,e],{[k]:{id:i,set:ot[r](e),fastSet:st[r](e),fastSetWithChangeDetection:ct[r](e),get:lt[r](e),createStore:()=>Xe(e),relation:null,type:r}});return Object.defineProperty(a,"id",{value:i,writable:!1,enumerable:!0,configurable:!1}),Object.defineProperty(a,"schema",{value:e,writable:!1,enumerable:!0,configurable:!1}),a}var F=ft;function I(e,t){let n=e[k],r=t[k],i={generationId:n.entityMasks.length-1,bitflag:n.bitflag,trait:t,store:r.createStore(),queries:new Set,trackingQueries:new Set,notQueries:new Set,relationQueries:new Set,schema:t.schema,changeSubscriptions:new Set,addSubscriptions:new Set,removeSubscriptions:new Set},a=t.id;a>=n.traitInstances.length&&(n.traitInstances.length=a+1),n.traitInstances[a]=i,e.traits.add(t),r.relation&&n.relations.add(r.relation);let o=e[k];o.bitflag*=2,o.bitflag>=2**31&&(o.bitflag=1,o.entityMasks.push([])),Ae in t&&Je(e,t)}function pt(e,t,n){let r=n[Ae].relation;return new Ye(e,t,r,n)}function mt(e,t,...n){for(let r=0;r<n.length;r++){let i=n[r];if(i?.[M]){let n=i.relation,r=i.target;if(typeof r==`number`){let a=i.params,o=n[k],s=o.trait,c,l=e[k],u=n[k],d=u.trait,f=l.traitInstances[d.id];if(!f||!f.relationTargets)c=!1;else{let e=t&A;if(u.exclusive)c=f.relationTargets[e]===r;else{let t=f.relationTargets[e];c=t?t.includes(r):!1}}if(!c){if(o.exclusive){let i,a=e[k],o=n[k],c=a.traitInstances[o.trait.id];if(!c||!c.relationTargets)i=void 0;else{let e=t&A;i=o.exclusive?c.relationTargets[e]:c.relationTargets[e]?.[0]}let l=i;if(l!==void 0&&l!==r){let r=e[k].traitInstances[s.id];if(r)for(let e of r.removeSubscriptions)e(t,l);Dt(e,n,t,l)}}let i;if(_t(e,t,s))i=void 0;else{let n=e[k],r=s.id;r<n.traitInstances.length&&n.traitInstances[r]!==void 0||I(e,s);let a=n.traitInstances[s.id],{generationId:o,bitflag:c,queries:l,trackingQueries:u}=a,d=t&A;n.entityMasks[o][d]|=c;for(let e of n.dirtyMasks.values())e[o]||(e[o]=[]),e[o][d]|=c;for(let n of l)n.toRemove.remove(t),(n.relationFilters&&n.relationFilters.length>0?We(e,n,t):n.check(e,t))?n.add(t):n.remove(e,t);for(let n of u)n.toRemove.remove(t),(n.relationFilters&&n.relationFilters.length>0?Ke(e,n,t,`add`,o,c):n.checkTracking(e,t,`add`,o,c))?n.add(t):n.remove(e,t);n.entityTraits.get(t).add(s),i=a}let c=i,l=Et(e,n,t,r);if(l!==-1){let i=c?.schema_6_$f??e[k].traitInstances[s.id].schema,o;if(s[k].type===`aos`)o=typeof i==`function`?i():null;else if(!i||typeof i==`function`||Object.keys(i).length===0)o=null;else{let e={};for(let t in i)typeof i[t]==`function`?e[t]=i[t]():e[t]=i[t];o=e}let u=o;u?Pt(e,t,n,l,{...u,...a}):a&&Pt(e,t,n,l,a),c??=e[k].traitInstances[s.id];for(let e of c.addSubscriptions)e(t,r)}}}continue}let a,o;Array.isArray(i)?[a,o]=i:a=i;let s;if(_t(e,t,a))s=void 0;else{let n=e[k],r=a.id;r<n.traitInstances.length&&n.traitInstances[r]!==void 0||I(e,a);let i=n.traitInstances[a.id],{generationId:o,bitflag:c,queries:l,trackingQueries:u}=i,d=t&A;n.entityMasks[o][d]|=c;for(let e of n.dirtyMasks.values())e[o]||(e[o]=[]),e[o][d]|=c;for(let n of l)n.toRemove.remove(t),(n.relationFilters&&n.relationFilters.length>0?We(e,n,t):n.check(e,t))?n.add(t):n.remove(e,t);for(let n of u)n.toRemove.remove(t),(n.relationFilters&&n.relationFilters.length>0?Ke(e,n,t,`add`,o,c):n.checkTracking(e,t,`add`,o,c))?n.add(t):n.remove(e,t);n.entityTraits.get(t).add(a),s=i}let c=s;if(!c)continue;let l=a[k],u;if(l.type===`aos`)u=typeof c.schema==`function`?c.schema():null;else if(!c.schema||typeof c.schema==`function`||Object.keys(c.schema).length===0)u=null;else{let e={};for(let t in c.schema)typeof c.schema[t]==`function`?e[t]=c.schema[t]():e[t]=c.schema[t];u=e}let d=Ae in a?pt(e,t,a):u;l.type===`aos`?vt(e,t,a,o??d,!1):d?vt(e,t,a,{...d,...o},!1):o&&vt(e,t,a,o,!1);for(let e of c.addSubscriptions)e(t)}}function ht(e,t,...n){for(let r=0;r<n.length;r++){let i=n[r];if(i?.[M]){let n=i.relation,r=i.target,a=n[k].trait;if(_t(e,t,a)){let i=e[k].traitInstances[a.id];if(r===`*`){if(i){let r,a=e[k],o=n[k],s=a.traitInstances[o.trait.id];if(!s||!s.relationTargets)r=[];else{let e=t&A;if(o.exclusive){let t=s.relationTargets[e];r=t===void 0?[]:[t]}else{let t=s.relationTargets[e];r=t===void 0?[]:t.slice()}}let c=r;for(let e of c)for(let n of i.removeSubscriptions)n(t,e)}jt(e,n,t),bt(e,t,a)}else if(typeof r==`number`){if(i)for(let e of i.removeSubscriptions)e(t,r);let{removedIndex:o,wasLastTarget:s}=Dt(e,n,t,r);o===-1||s&&bt(e,t,a)}}continue}if(!_t(e,t,i))continue;let a=i[k];if(a.relation){let n=e[k].traitInstances[i.id];if(n){let r,i=e[k],o=a.relation[k],s=i.traitInstances[o.trait.id];if(!s||!s.relationTargets)r=[];else{let e=t&A;if(o.exclusive){let t=s.relationTargets[e];r=t===void 0?[]:[t]}else{let t=s.relationTargets[e];r=t===void 0?[]:t.slice()}}let c=r;for(let e of c)for(let r of n.removeSubscriptions)r(t,e)}jt(e,a.relation,t)}else{let n=e[k].traitInstances[i.id];if(n)for(let e of n.removeSubscriptions)e(t)}bt(e,t,i)}}function gt(e,t,n,r){let i=t[k].trait,a=e[k].traitInstances[i.id];if(a)for(let e of a.removeSubscriptions)e(n,r);let{removedIndex:o,wasLastTarget:s}=Dt(e,t,n,r);o!==-1&&s&&bt(e,n,i)}function _t(e,t,n){let r=e[k],i=r.traitInstances[n.id];if(!i)return!1;let{generationId:a,bitflag:o}=i,s=t&A;return(r.entityMasks[a][s]&o)===o}function vt(e,t,n,r,i=!0){if(n?.[M]){let a=n.relation,o=n.target;typeof o==`number`?(Ft(e,t,a,o,r),i&&qe(e,t,a[k].trait,o)):result_setTraitForPair_47_$f=void 0;return}let a=n[k],o=e[k].traitInstances[n.id].store,s=t&A;r instanceof Function&&(r=r(a.get(s,o))),a.set(s,o,r),i&&P(e,t,n)}function yt(e,t,n){if(n?.[M]){let r,i=n.relation,a=n.target;return r=Lt(e,t,n)&&typeof a==`number`?It(e,t,i,a):void 0,r}let r;if(!_t(e,t,n))r=void 0;else{let i=n[k],a=e[k].traitInstances[n.id].store;r=i.get(t&A,a)}return r}function bt(e,t,n){if(!_t(e,t,n))return;let r=e[k],{generationId:i,bitflag:a,queries:o,trackingQueries:s}=r.traitInstances[n.id],c=t&A;r.entityMasks[i][c]&=~a;for(let e of r.dirtyMasks.values())e[i][c]|=a;for(let n of o)(n.relationFilters&&n.relationFilters.length>0?We(e,n,t):n.check(e,t))?n.add(t):n.remove(e,t);for(let n of s)(n.relationFilters&&n.relationFilters.length>0?Ke(e,n,t,`remove`,i,a):n.checkTracking(e,t,`remove`,i,a))?n.add(t):n.remove(e,t);r.entityTraits.get(t).delete(n)}function xt(e){let t=F(e?.store??{}),n=t[k];n.relation=null;let r=!1;e?.autoDestroy===`orphan`||e?.autoDestroy===`source`?r=`source`:e?.autoDestroy===`target`&&(r=`target`),e?.autoRemoveTarget&&(console.warn(`Koota: 'autoRemoveTarget' is deprecated. Use 'autoDestroy: "orphan"' instead.`),r=`source`);let i={trait:t,exclusive:e?.exclusive??!1,autoDestroy:r};function a(...e){let t=e[0];if(t===void 0)throw Error(`Relation target is undefined`);if(t===`*`||typeof t==`number`)return{[M]:!0,relation:a,target:t,params:e[1]};if(t?.[He]){if(e.length>1)throw Error(`Query relations do not accept additional parameters.`);return{[M]:!0,relation:a,targetQuery:t}}return{[M]:!0,relation:a,targetQuery:e}}let o=Object.assign(a,{[k]:i});return Object.defineProperty(o,ke,{value:!0,writable:!1,enumerable:!1,configurable:!1}),n.relation=o,o}var St=xt,Ct=Object.freeze([]);function wt(e,t,n){let r=e.relationSourcesByTarget??=[];(r[n&A]??=[]).push(t)}function Tt(e,t,n){let r=e.relationSourcesByTarget?.[n&A];if(!r)return;let i=r.indexOf(t);if(i===-1)return;let a=r.length-1;i!==a&&(r[i]=r[a]),r.pop()}function Et(e,t,n,r){let i=e[k],a=t[k],o=a.trait,s=i.traitInstances[o.id];if(!s)return-1;s.relationTargets||=[];let c=n&A,l;if(a.exclusive){let e=s.relationTargets,t=e[c];if(t===r)return-1;t!==void 0&&Tt(s,n,t),e[c]=r,l=0}else{let e=s.relationTargets;if(e[c]||(e[c]=[]),e[c].indexOf(r)!==-1)return-1;l=e[c].length,e[c].push(r)}return wt(s,n,r),Ot(e,t,n),l}function Dt(e,t,n,r){let i=e[k],a=t[k],o=a.trait,s=i.traitInstances[o.id];if(!s||!s.relationTargets)return{removedIndex:-1,wasLastTarget:!1};let c=n&A,l=-1,u=!1;if(a.exclusive){let e=s.relationTargets;e[c]===r&&(Tt(s,n,r),e[c]=void 0,l=0,u=!1,At(s.store,o[k].type,c,0,!0))}else{let e=s.relationTargets[c];if(e){let t=e.indexOf(r);if(t!==-1){let i=e.length-1;Tt(s,n,r),t!==i&&(e[t]=e[i]),e.pop(),kt(s.store,o[k].type,c,t,i),l=t,u=e.length>0}}}return l!==-1&&Ot(e,t,n),{removedIndex:l,wasLastTarget:l!==-1&&!u}}function Ot(e,t,n){let r=e[k],i=t[k].trait,a=r.traitInstances[i.id];if(a)for(let t of a.relationQueries)We(e,t,n)?t.add(n):t.remove(e,n)}function kt(e,t,n,r,i){if(t===`aos`){let t=e[n];t&&(r!==i&&(t[r]=t[i]),t.pop())}else for(let t in e){let a=e[t][n];a&&(r!==i&&(a[r]=a[i]),a.pop())}}function At(e,t,n,r,i){if(i)if(t===`aos`)e[n]=void 0;else for(let t in e)e[t][n]=void 0}function jt(e,t,n){let r,i=e[k],a=t[k],o=i.traitInstances[a.trait.id];if(!o||!o.relationTargets)r=[];else{let e=n&A;if(a.exclusive){let t=o.relationTargets[e];r=t===void 0?[]:[t]}else{let t=o.relationTargets[e];r=t===void 0?[]:t.slice()}}let s=r;for(let r of s)Dt(e,t,n,r)}function Mt(e,t,n){let r=e[k];if(!e.has(n))return Ct;let i=t[k].trait,a=r.traitInstances[i.id];return a?.relationSourcesByTarget?a.relationSourcesByTarget[n&A]?.slice()??Ct:Ct}function Nt(e,t,n,r){let i=e[k],a=t[k],o=i.traitInstances[a.trait.id];if(!o?.relationTargets)return!1;let s=n&A;if(a.exclusive){let e=o.relationTargets[s];return e!==void 0&&r.has(e)}let c=o.relationTargets[s];if(!c)return!1;for(let e=0;e<c.length;e++)if(r.has(c[e]))return!0;return!1}function Pt(e,t,n,r,i){let a=n[k],o=a.trait,s=e[k].traitInstances[o.id];if(!s)return;let c=s.store,l=t&A;if(o[k].type===`aos`){a.exclusive?c[l]=i:(c[l]??=[])[r]=i;return}if(a.exclusive)for(let e in i)c[e][l]=i[e];else for(let e in i)(c[e][l]??=[])[r]=i[e]}function Ft(e,t,n,r,i){let a,o=e[k],s=n[k],c=s.trait,l=o.traitInstances[c.id];if(!l||!l.relationTargets)a=-1;else{let e=t&A;if(s.exclusive)a=l.relationTargets[e]===r?0:-1;else{let t=l.relationTargets[e];a=t?t.indexOf(r):-1}}let u=a;u!==-1&&Pt(e,t,n,u,i)}function It(e,t,n,r){let i=e[k],a=n[k].trait,o=i.traitInstances[a.id];if(!o)return;let s,c=e[k],l=n[k],u=l.trait,d=c.traitInstances[u.id];if(!d||!d.relationTargets)s=-1;else{let e=t&A;if(l.exclusive)s=d.relationTargets[e]===r?0:-1;else{let t=d.relationTargets[e];s=t?t.indexOf(r):-1}}let f=s;if(f===-1)return;let p=a[k],m=o.store,h=t&A,g=n[k];if(p.type===`aos`)return g.exclusive?m[h]:m[h]?.[f];{let e={},t=m;for(let n in m)g.exclusive?e[n]=t[n][h]:e[n]=t[n][h]?.[f];return e}}function Lt(e,t,n){let r=n.relation,i=n.target,a=n.targetQuery;if(!_t(e,t,r[k].trait))return!1;if(a){let n=a?.[He]?e.query(a):e.query(...a);if(!n.length)return!1;let i,o=e[k],s=r[k],c=o.traitInstances[s.trait.id];if(!c||!c.relationTargets)i=[];else{let e=t&A;if(s.exclusive){let t=c.relationTargets[e];i=t===void 0?[]:[t]}else{let t=c.relationTargets[e];i=t===void 0?[]:t.slice()}}let l=i;for(let e=0;e<l.length;e++)if(n.includes(l[e]))return!0;return!1}if(i===`*`)return!0;if(typeof i==`number`){let n,a=e[k],o=r[k],s=o.trait,c=a.traitInstances[s.id];if(!c||!c.relationTargets)n=!1;else{let e=t&A;if(o.exclusive)n=c.relationTargets[e]===i;else{let t=c.relationTargets[e];n=t?t.includes(i):!1}}return n}return!1}var Rt=(...e)=>Fe(`not`,1,e),zt=class{_dense=[];_sparse=[];_cursor=0;_denseRaw={array:this._dense,length:0};has(e){let t=this._sparse[e];return t<this._cursor&&this._dense[t]===e}add(e){this.has(e)||(this._sparse[e]=this._cursor,this._dense[this._cursor++]=e)}remove(e){if(!this.has(e))return;let t=this._sparse[e];this._cursor--;let n=this._dense[this._cursor];n!==e&&(this._dense[t]=n,this._sparse[n]=t)}clear(){for(let e=0;e<this._cursor;e++)this._sparse[this._dense[e]]=0;this._cursor=0}sort(){this._dense.sort((e,t)=>e-t);for(let e=0;e<this._dense.length;e++)this._sparse[this._dense[e]]=e}getIndex(e){return this._sparse[e]}get dense(){return this._dense.slice(0,this._cursor)}get denseRaw(){return this._denseRaw.length=this._cursor,this._denseRaw}get rawDense(){return this._dense}get length(){return this._cursor}get sparse(){return this._sparse}};function Bt(e,t,n,r){let i=[],a=[];for(let t=0;t<r.length;t++){let n=r[t];if(n?.[M]){let t=n.relation[k].trait;if(t[k].type!==`tag`){i.push(t);let n=e[k].traitInstances[t.id];a.push(n.store)}continue}if(n?.[Pe]){if(n.type===`not`)continue;let t=n.traits;for(let n of t){if(n[k].type===`tag`)continue;i.push(n);let t=e[k].traitInstances[n.id];a.push(t.store)}}else{let t=n;if(t[k].type===`tag`)continue;i.push(t);let r=e[k].traitInstances[t.id];a.push(r.store)}}let o=Object.assign(t,{readEach(e){let n=Array.from({length:i.length});for(let r=0;r<t.length;r++){let o=t[r],s=o&A;for(let e=0;e<i.length;e++)n[e]=i[e][k].get(s,a[e]);e(n,o,r)}return o},updateEach(r,s={changeDetection:`auto`}){let c=Array.from({length:i.length});if(s.changeDetection===`auto`){let o=[],s=[],l=[],u=[];for(let t=0;t<i.length;t++){let r=i[t],a=e[k].trackedTraits.has(r),o=n.hasChangedModifiers&&n.changedTraits.has(r);a||o?l.push(t):u.push(t)}for(let n=0;n<t.length;n++){let d=t[n],f=d&A;for(let e=0;e<i.length;e++){let t=i[e][k],n=t.get(f,a[e]);c[e]=n,s[e]=t.type===`aos`?{...n}:null}if(r(c,d,n),e.has(d)){for(let e=0;e<l.length;e++){let t=l[e],n=i[t],r=n[k],u=c[t],p=a[t],m=!1;r.type===`aos`?(m=r.fastSetWithChangeDetection(f,p,u),m||=!Oe(u,s[t])):m=r.fastSetWithChangeDetection(f,p,u),m&&o.push([d,n])}for(let e=0;e<u.length;e++){let t=u[e],n=i[t][k],r=a[t];n.fastSet(f,r,c[t])}}}for(let t=0;t<o.length;t++){let[n,r]=o[t];P(e,n,r)}}else if(s.changeDetection===`always`){let n=[],o=[];for(let s=0;s<t.length;s++){let l=t[s],u=l&A;for(let e=0;e<i.length;e++){let t=i[e][k],n=t.get(u,a[e]);c[e]=n,o[e]=t.type===`aos`?{...n}:null}if(r(c,l,s),e.has(l))for(let e=0;e<i.length;e++){let t=i[e],r=t[k],s=c[e],d=!1;r.type===`aos`?(d=r.fastSetWithChangeDetection(u,a[e],s),d||=!Oe(s,o[e])):d=r.fastSetWithChangeDetection(u,a[e],s),d&&n.push([l,t])}}for(let t=0;t<n.length;t++){let[r,i]=n[t];P(e,r,i)}}else if(s.changeDetection===`never`)for(let n=0;n<t.length;n++){let o=t[n],s=o&A;for(let e=0;e<i.length;e++)c[e]=i[e][k].get(s,a[e]);if(r(c,o,n),e.has(o))for(let e=0;e<i.length;e++)i[e][k].fastSet(s,a[e],c[e])}return o},useStores(e){return e(a,t),o},select(...t){i.length=0,a.length=0;for(let n=0;n<t.length;n++){let r=t[n];if(r?.[M]){let t=r.relation[k].trait;if(t[k].type!==`tag`){i.push(t);let n=e[k].traitInstances[t.id];a.push(n.store)}continue}if(r?.[Pe]){if(r.type===`not`)continue;let t=r.traits;for(let n of t){if(n[k].type===`tag`)continue;i.push(n);let t=e[k].traitInstances[n.id];a.push(t.store)}}else{let t=r;if(t[k].type===`tag`)continue;i.push(t);let n=e[k].traitInstances[t.id];a.push(n.store)}}return o},sort(e=(e,t)=>(e&A)-(t&A)){return Array.prototype.sort.call(t,e),o}});return o}var Vt={readEach(e){for(let t=0;t<this.length;t++)e([],this[t],t);return this},updateEach(e){for(let t=0;t<this.length;t++)e([],this[t],t);return this},useStores(e){return e([],this),this},select(){return this},sort(e=(e,t)=>(e&A)-(t&A)){return Array.prototype.sort.call(this,e),this}};function Ht(e){return e.length===0?Ut:Object.assign(e,Vt)}var Ut=Object.assign([],Vt),Wt=1e5,Gt=1e7,Kt=5e6,qt=9e6,Jt=new Float64Array(1024),Yt=1,Xt=new Map;function Zt(e){let t=Xt.get(e);return t===void 0&&(t=Yt++,Xt.set(e,t)),t}var Qt=e=>{let t=0;for(let n=0;n<e.length;n++){let r=e[n];if(r?.[M]){let e=r.relation[k].trait.id;if(r.targetQuery){let n=r.targetQuery?.[He]?r.targetQuery.hash:Qt([...r.targetQuery]);Jt[t++]=e*Gt+Zt(n)+qt;continue}let n=r.target,i=typeof n==`number`?n:-1;Jt[t++]=e*Gt+i+Kt;continue}if(r?.[Pe]){for(let e=0;e<r.traitIds.length;e++)Jt[t++]=r.id*Wt+r.traitIds[e];continue}Jt[t++]=r.id}let n=Jt.subarray(0,t);return n.sort(),n.join(`,`)},$t=F();function en(e){if(!e.targetQuery)return e;let t=e.targetQuery?.[He]?e.targetQuery:un(...e.targetQuery);return{...e,targetQueryRef:t,targetQueryMatches:new zt}}function tn(e,t,n){an(e);let r=t.entities.dense.slice();if(t.isTracking){t.entities.clear();let e=r.length;for(let n=0;n<e;n++)t.resetTrackingBitmasks(r[n])}return Bt(e,r,t,n)}function nn(e,t){e.toRemove.remove(t),e.entities.add(t);for(let n of e.addSubscriptions)n(t);e.version++}function rn(e,t,n){if(!t.entities.has(n)||t.toRemove.has(n))return;let r=e[k];t.toRemove.add(n),r.dirtyQueries.add(t);for(let e of t.removeSubscriptions)e(n);t.version++}function an(e){let t=e[k];if(t.dirtyQueries.size){for(let e of t.dirtyQueries)for(let t=e.toRemove.dense.length-1;t>=0;t--){let n=e.toRemove.dense[t];e.toRemove.remove(n),e.entities.remove(n)}t.dirtyQueries.clear()}}function on(e,t){let n=e.trackingGroups,r=n.length;for(let e=0;e<r;e++){let r=n[e].trackers,i=r.length;for(let e=0;e<i;e++){let n=r[e];n&&(n[t]=0)}}}function sn(e,t,n,r,i,a){let o=Le(n);if(!o)return;let s=n.id,c=`${o}-${s}-${r}`,l=a.get(c);l||(l={logic:r,type:o,id:s,bitmasks:[],trackers:[]},a.set(c,l),t.trackingGroups.push(l));for(let r of n.traits){let n=r.id;n<i.traitInstances.length&&i.traitInstances[n]!==void 0||I(e,r);let a=i.traitInstances[r.id];t.traits.push(r),t.traitInstances.all.push(a);let s=a.generationId;l.bitmasks[s]=(l.bitmasks[s]||0)|a.bitflag,o===`change`&&(t.changedTraits.add(r),t.hasChangedModifiers=!0)}t.isTracking=!0}function cn(e,t){let n={version:0,world:e,parameters:t,hash:``,traits:[],traitInstances:{required:[],forbidden:[],or:[],all:[]},staticBitmasks:[],trackingGroups:[],generations:[],entities:new zt,isTracking:!1,hasChangedModifiers:!1,changedTraits:new Set,toRemove:new zt,cleanup:[],addSubscriptions:new Set,removeSubscriptions:new Set,relationFilters:[],run:(e,t)=>tn(e,n,t),add:e=>nn(n,e),remove:(e,t)=>rn(e,n,t),check:(e,t)=>Ue(e,n,t),checkTracking:(e,t,r,i,a)=>Ge(e,n,t,r,i,a),resetTrackingBitmasks:e=>on(n,e)},r=e[k],i=new Map;for(let a=0;a<t.length;a++){let o=t[a];if(o?.[M]){let t=o.relation;n.relationFilters.push(en(o));let i=t[k].trait,a=i.id;a<r.traitInstances.length&&r.traitInstances[a]!==void 0||I(e,i),n.traitInstances.required.push(r.traitInstances[i.id]),n.traits.push(i);continue}if(o?.[Pe]){let t=o.traits;for(let n=0;n<t.length;n++){let i=t[n],a=i.id;a<r.traitInstances.length&&r.traitInstances[a]!==void 0||I(e,i)}if(o.type===`not`)n.traitInstances.forbidden.push(...t.map(e=>r.traitInstances[e.id]));else if(o.type===`or`){if(n.traitInstances.or.push(...t.map(e=>r.traitInstances[e.id])),Re(o))for(let t of o.modifiers)Ie(t)&&sn(e,n,t,`or`,r,i)}else Ie(o)&&sn(e,n,o,`and`,r,i)}else{let t=o,i=t.id;i<r.traitInstances.length&&r.traitInstances[i]!==void 0||I(e,t),n.traitInstances.required.push(r.traitInstances[t.id]),n.traits.push(t)}}n.traitInstances.forbidden.push(r.traitInstances[$t.id]),n.traitInstances.all=[...n.traitInstances.all,...n.traitInstances.required,...n.traitInstances.forbidden,...n.traitInstances.or],n.generations=n.traitInstances.all.map(e=>e.generationId).reduce((e,t)=>(e.includes(t)||e.push(t),e),[]),n.staticBitmasks=n.generations.map(e=>({required:n.traitInstances.required.filter(t=>t.generationId===e).reduce((e,t)=>e|t.bitflag,0),forbidden:n.traitInstances.forbidden.filter(t=>t.generationId===e).reduce((e,t)=>e|t.bitflag,0),or:n.traitInstances.or.filter(t=>t.generationId===e).reduce((e,t)=>e|t.bitflag,0)})),n.hash=Qt(t),r.queriesHashMap.set(n.hash,n),n.isTracking?n.traitInstances.all.forEach(e=>{e.trackingQueries.add(n)}):n.traitInstances.all.forEach(e=>{e.queries.add(n)}),n.traitInstances.forbidden.length>0&&r.notQueries.add(n);let a=n.relationFilters&&n.relationFilters.length>0;if(a)for(let t of n.relationFilters){let i=t.relation[k].trait,a=r.traitInstances[i.id];if(a&&a.relationQueries.add(n),t.targetQueryRef&&t.targetQueryMatches){let r=e.query(t.targetQueryRef);for(let e=0;e<r.length;e++)t.targetQueryMatches.add(r[e]);let i=r=>{let i=Mt(e,t.relation,r);for(let t=0;t<i.length;t++){let r=i[t];We(e,n,r)?n.add(r):n.remove(e,r)}};n.cleanup.push(e.onQueryAdd(t.targetQueryRef,e=>{t.targetQueryMatches.add(e),i(e)})),n.cleanup.push(e.onQueryRemove(t.targetQueryRef,e=>{t.targetQueryMatches.remove(e),i(e)}))}}if(n.trackingGroups.length>0)for(let t of n.trackingGroups){let{type:i,id:o,logic:s,bitmasks:c}=t,l=r.trackingSnapshots.get(o),u=r.dirtyMasks.get(o),d=r.changedMasks.get(o);for(let t of r.entityIndex.dense){if(n.entities.has(t))continue;let o=t&A,f=s===`and`;for(let e=0;e<c.length;e++){let t=c[e];if(!t)continue;let n=l[e]?.[o]||0,a=r.entityMasks[e]?.[o]||0;for(let r=1;r<=t;r<<=1){if(!(t&r))continue;let c=!1;switch(i){case`add`:c=(n&r)===0&&(a&r)===r;break;case`remove`:c=(n&r)===r&&(a&r)===0||(n&r)===0&&(a&r)===0&&((u[e]?.[o]??0)&r)===r;break;case`change`:c=((d[e]?.[o]??0)&r)===r;break}if(s===`and`){if(!c){f=!1;break}}else if(c){f=!0;break}}if(s===`and`&&!f||s===`or`&&f)break}if(f)if(a){let r=!0;for(let i of n.relationFilters)if(!Lt(e,t,i)){r=!1;break}r&&n.add(t)}else n.add(t)}}else{let t=r.entityIndex.dense;for(let r=0;r<t.length;r++){let i=t[r];(a?We(e,n,i):n.check(e,i))&&n.add(i)}}return n}var ln=0;function un(...e){let t=Qt(e),n=N.cachedQueries.get(t);if(n)return n;let r=ln++,i=Object.freeze({[He]:!0,id:r,hash:t,parameters:e});return N.cachedQueries.set(t,i),i}var dn=e=>({aliveCount:0,dense:[],sparse:[],maxId:0,worldId:e}),fn=e=>{if(e.aliveCount<e.dense.length){let t=De(e.dense[e.aliveCount]);return e.dense[e.aliveCount]=t,e.sparse[t&A]=e.aliveCount,e.aliveCount++,t}let t=e.maxId++,n=Ee(e.worldId,0,t);return e.dense.push(n),e.sparse[t]=e.aliveCount,e.aliveCount++,n},pn=(e,t)=>{let n=t&A,r=e.sparse[n];if(r===void 0||r>=e.aliveCount)return;let i=e.aliveCount-1,a=e.dense[i],o=a&A;e.sparse[o]=r,e.dense[r]=a,e.sparse[n]=i,e.dense[i]=t,e.aliveCount--},mn=e=>e.dense.slice(0,e.aliveCount);Number.prototype.add=function(...e){let t=this>>>j;return mt(N.worlds[t],this,...e)},Number.prototype.remove=function(...e){let t=this>>>j;return ht(N.worlds[t],this,...e)},Number.prototype.has=function(e){let t=this>>>j,n=N.worlds[t];if(e?.[M])return Lt(n,this,e);let r,i=n[k],a=i.traitInstances[e.id];if(!a)r=!1;else{let{generationId:e,bitflag:t}=a,n=this&A;r=(i.entityMasks[e][n]&t)===t}return r},Number.prototype.destroy=function(){let e=this>>>j;return vn(N.worlds[e],this)},Number.prototype.changed=function(e){let t=this>>>j;return P(N.worlds[t],this,e)},Number.prototype.get=function(e){let t=this>>>j;return yt(N.worlds[t],this,e)},Number.prototype.set=function(e,t,n=!0){let r=this>>>j;vt(N.worlds[r],this,e,t,n)},Number.prototype.targetsFor=function(e){let t,n=this>>>j,r=N.worlds[n][k],i=e[k],a=r.traitInstances[i.trait.id];if(!a||!a.relationTargets)t=[];else{let e=this&A;if(i.exclusive){let n=a.relationTargets[e];t=n===void 0?[]:[n]}else{let n=a.relationTargets[e];t=n===void 0?[]:n.slice()}}return t},Number.prototype.targetFor=function(e){let t,n=this>>>j,r=N.worlds[n][k],i=e[k],a=r.traitInstances[i.trait.id];if(!a||!a.relationTargets)t=void 0;else{let e=this&A;t=i.exclusive?a.relationTargets[e]:a.relationTargets[e]?.[0]}return t},Number.prototype.id=function(){return this&A},Number.prototype.generation=function(){return this>>>Te&we},Number.prototype.isAlive=function(){let e=this>>>j,t=N.worlds[e][k].entityIndex,n,r=t.sparse[this&A];if(r===void 0||r>=t.aliveCount)n=!1;else{let e=t.dense[r];n=(this>>>Te&we)==(e>>>Te&we)&&this>>>j===t.worldId}return n};function hn(e,...t){let n=e[k],r=fn(n.entityIndex);for(let t of n.notQueries)t.check(e,r)&&t.add(r),t.resetTrackingBitmasks(r&A);return n.entityTraits.set(r,new Set),mt(e,r,...t),r}var gn=new Set,_n=[];function vn(e,t){let n=e[k];if(!e.has(t))throw Error(`Koota: The entity being destroyed does not exist.`);let r=_n,i=gn;for(r.length=0,r.push(t),i.clear();r.length>0;){let t=r.pop();if(i.has(t))continue;i.add(t);for(let a of n.relations){let n=a[k],o=Mt(e,a,t);for(let i=o.length-1;i>=0;i--){let s=o[i];e.has(s)&&(gt(e,a,s,t),n.autoDestroy===`source`&&r.push(s))}if(n.autoDestroy===`target`){let n,o=e[k],s=a[k],c=o.traitInstances[s.trait.id];if(!c||!c.relationTargets)n=[];else{let e=t&A;if(s.exclusive){let t=c.relationTargets[e];n=t===void 0?[]:[t]}else{let t=c.relationTargets[e];n=t===void 0?[]:t.slice()}}let l=n;for(let t of l)e.has(t)&&(i.has(t)||r.push(t))}}let a=n.entityTraits.get(t);if(a)for(let n of a)ht(e,t,n);pn(n.entityIndex,t);let o=n.queriesHashMap.get(``);o&&o.remove(e,t),n.entityTraits.delete(t);let s=t&A;for(let e=0;e<n.entityMasks.length;e++)n.entityMasks[e][s]=0}}function yn(e,...t){let n=Me(N.worldIndex),r=!1,i;function a(e){return e?.[M]?e.relation[k].trait:e?.[ke]?e[k].trait:e}function o(e,t){if(e?.[M]){let n=e.targetQuery;if(n){let e=n?.[He]?n:un(...n);return(n,r)=>{r!==void 0&&s.query(e).includes(r)&&t(n,r)}}let r=e.target;return r===`*`?t:(e,n)=>{n===r&&t(e,n)}}return t}let s={[k]:{entityIndex:dn(n),entityMasks:[[]],entityTraits:new Map,bitflag:1,traitInstances:[],relations:new Set,queriesHashMap:new Map,queryInstances:[],actionInstances:[],notQueries:new Set,dirtyQueries:new Set,dirtyMasks:new Map,trackingSnapshots:new Map,changedMasks:new Map,worldEntity:null,trackedTraits:new Set,resetSubscriptions:new Set},traits:new Set,init(...e){let t=s[k];if(r)return;r=!0,N.worlds[n]=s;let a=Be();for(let e=0;e<a;e++)Ve(s,e);let o=$t.id;o<t.traitInstances.length&&t.traitInstances[o]!==void 0||I(s,$t),i&&=(e=i,void 0),t.worldEntity=hn(s,$t,...e)},spawn(...e){return hn(s,...e)},has(e){let t,n=s[k].entityIndex.sparse[e&A];if(n===void 0||n>=s[k].entityIndex.aliveCount)t=!1;else{let r=s[k].entityIndex.dense[n];t=(e>>>Te&we)==(r>>>Te&we)&&e>>>j===s[k].entityIndex.worldId}return typeof e==`number`?t:_t(s,s[k].worldEntity,e)},add(...e){mt(s,s[k].worldEntity,...e)},remove(...e){ht(s,s[k].worldEntity,...e)},get(e){return yt(s,s[k].worldEntity,e)},set(e,t){vt(s,s[k].worldEntity,e,t,!0)},destroy(){vn(s,s[k].worldEntity),s[k].worldEntity=null,s.reset(),r=!1,Ne(N.worldIndex,n),N.worlds[n]=null},reset(){i=void 0;let e=s[k];s.entities.forEach(e=>{s.has(e)&&vn(s,e)}),e.entityIndex=dn(n),e.entityTraits.clear(),e.entityMasks=[[]],e.bitflag=1;for(let t of e.queriesHashMap.values())for(let e=0;e<t.cleanup.length;e++)t.cleanup[e]();e.traitInstances.length=0,s.traits.clear(),e.relations.clear(),e.queriesHashMap.clear(),e.queryInstances.length=0,e.actionInstances.length=0,e.dirtyQueries.clear(),e.notQueries.clear(),e.trackingSnapshots.clear(),e.dirtyMasks.clear(),e.changedMasks.clear(),e.trackedTraits.clear(),e.worldEntity=hn(s,$t);for(let t of e.resetSubscriptions)t(s)},query(...e){let t=s[k];if(e.length===1&&e[0]?.[He]){let n=e[0],r=t.queryInstances[n.id];return r?r.run(s,n.parameters):(r=t.queriesHashMap.get(n.hash),r||(r=cn(s,n.parameters),t.queriesHashMap.set(n.hash,r),n.id>=t.queryInstances.length&&(t.queryInstances.length=n.id+1),t.queryInstances[n.id]=r),r.run(s,n.parameters))}else{let n=e;if(n.length===1&&n[0]?.[M]){let e=n[0].relation,t=n[0].target;if(!n[0].targetQuery&&typeof t==`number`)return Ht(Mt(s,e,t))}let r=Qt(n),i=t.queriesHashMap.get(r);return i||(i=cn(s,n),t.queriesHashMap.set(r,i)),i.run(s,n)}},queryFirst(...e){return s.query(...e)[0]},onQueryAdd(e,t){let n=s[k],r;if(e?.[He]){let t=e;r=n.queryInstances[t.id]||n.queriesHashMap.get(t.hash),r||(r=cn(s,t.parameters),n.queriesHashMap.set(t.hash,r),t.id>=n.queryInstances.length&&(n.queryInstances.length=t.id+1),n.queryInstances[t.id]=r)}else{let t=Qt(e);r=n.queriesHashMap.get(t),r||(r=cn(s,e),n.queriesHashMap.set(t,r))}return r.addSubscriptions.add(t),()=>r.addSubscriptions.delete(t)},onQueryRemove(e,t){let n=s[k],r;if(e?.[He]){let t=e;r=n.queryInstances[t.id]||n.queriesHashMap.get(t.hash),r||(r=cn(s,t.parameters),n.queriesHashMap.set(t.hash,r),t.id>=n.queryInstances.length&&(n.queryInstances.length=t.id+1),n.queryInstances[t.id]=r)}else{let t=Qt(e);r=n.queriesHashMap.get(t),r||(r=cn(s,e),n.queriesHashMap.set(t,r))}return r.removeSubscriptions.add(t),()=>r.removeSubscriptions.delete(t)},onAdd(e,t){let n=s[k],r=a(e),i=o(e,t),c=n.traitInstances[r.id];return c||=(I(s,r),n.traitInstances[r.id]),c.addSubscriptions.add(i),()=>c.addSubscriptions.delete(i)},onRemove(e,t){let n=s[k],r=a(e),i=o(e,t),c=n.traitInstances[r.id];return c||=(I(s,r),n.traitInstances[r.id]),c.removeSubscriptions.add(i),()=>c.removeSubscriptions.delete(i)},onChange(e,t){let n=s[k],r=a(e),i=o(e,t),c=r.id;c<n.traitInstances.length&&n.traitInstances[c]!==void 0||I(s,r);let l=n.traitInstances[r.id];return l.changeSubscriptions.add(i),n.trackedTraits.add(r),()=>{l.changeSubscriptions.delete(i),l.changeSubscriptions.size===0&&n.trackedTraits.delete(r)}}};if(Object.defineProperty(s,"id",{get:()=>n,enumerable:!0}),Object.defineProperty(s,"isInitialized",{get:()=>r,enumerable:!0}),Object.defineProperty(s,"entities",{get:()=>mn(s[k].entityIndex),enumerable:!0}),e&&typeof e==`object`&&!Array.isArray(e)){let{traits:t=[],lazy:n=!1}=e;n?i=t:s.init(...t)}else s.init(...e?[e,...t]:t);return s}var bn=e({ChildOf:()=>xn,SubEntityLink:()=>Cn,SubEntityLinkType:()=>Sn}),xn=St({exclusive:!0}),Sn={HoverLink:`HoverLink`},Cn=St({store:{indexMapping:()=>`index`,type:``}}),wn=function(e){return e[e.UNSPECIFIED=0]=`UNSPECIFIED`,e[e.RGB=1]=`RGB`,e}({});d.util.setEnumType(wn,`draw.v1.ColorFormat`,[{no:0,name:`COLOR_FORMAT_UNSPECIFIED`},{no:1,name:`COLOR_FORMAT_RGB`}]);var Tn=class e extends p{chunkSize=0;total=0;stride=0;constructor(e){super(),d.util.initPartial(e,this)}static runtime=d;static typeName=`draw.v1.Chunks`;static fields=d.util.newFieldList(()=>[{no:1,name:`chunk_size`,kind:`scalar`,T:13},{no:2,name:`total`,kind:`scalar`,T:13},{no:3,name:`stride`,kind:`scalar`,T:13}]);static fromBinary(t,n){return new e().fromBinary(t,n)}static fromJson(t,n){return new e().fromJson(t,n)}static fromJsonString(t,n){return new e().fromJsonString(t,n)}static equals(t,n){return d.util.equals(e,t,n)}},En=class e extends p{targetUuid=new Uint8Array;type=``;indexMapping;constructor(e){super(),d.util.initPartial(e,this)}static runtime=d;static typeName=`draw.v1.Relationship`;static fields=d.util.newFieldList(()=>[{no:1,name:`target_uuid`,kind:`scalar`,T:12},{no:2,name:`type`,kind:`scalar`,T:9},{no:3,name:`index_mapping`,kind:`scalar`,T:9,opt:!0}]);static fromBinary(t,n){return new e().fromBinary(t,n)}static fromJson(t,n){return new e().fromJson(t,n)}static fromJsonString(t,n){return new e().fromJsonString(t,n)}static equals(t,n){return d.util.equals(e,t,n)}},Dn=class e extends p{colors;colorFormat=0;opacities;showAxesHelper;invisible;chunks;relationships=[];constructor(e){super(),d.util.initPartial(e,this)}static runtime=d;static typeName=`draw.v1.Metadata`;static fields=d.util.newFieldList(()=>[{no:1,name:`colors`,kind:`scalar`,T:12,opt:!0},{no:2,name:`color_format`,kind:`enum`,T:d.getEnumType(wn)},{no:3,name:`opacities`,kind:`scalar`,T:12,opt:!0},{no:4,name:`show_axes_helper`,kind:`scalar`,T:8,opt:!0},{no:5,name:`invisible`,kind:`scalar`,T:8,opt:!0},{no:6,name:`chunks`,kind:`message`,T:Tn,opt:!0},{no:7,name:`relationships`,kind:`message`,T:En,repeated:!0}]);static fromBinary(t,n){return new e().fromBinary(t,n)}static fromJson(t,n){return new e().fromJson(t,n)}static fromJsonString(t,n){return new e().fromJsonString(t,n)}static equals(t,n){return d.util.equals(e,t,n)}},On={ARROWS:6,POSITIONS:3,NURBS_CONTROL_POINTS:7,NURBS_KNOTS:1,COLORS_RGB:3},kn=(e,t)=>{if(e.length===0)return new Float32Array;if(e.byteOffset%4==0&&e.byteLength%4==0){let n=new Float32Array(e.buffer,e.byteOffset,e.byteLength/4);if(!t)return n;let r=new Float32Array(n.length);for(let e=0;e<n.length;e++)r[e]=t(n[e]);return r}let n=new Float32Array(e.byteLength/4),r=new DataView(e.buffer,e.byteOffset,e.byteLength);if(t)for(let e=0;e<n.length;e++)n[e]=t(r.getFloat32(e*4,!0));else for(let e=0;e<n.length;e++)n[e]=r.getFloat32(e*4,!0);return n},An=e=>e.byteOffset===0&&e.byteLength===e.buffer.byteLength?e.buffer:new Uint8Array(e).buffer,jn=(e,t,n=0)=>e.length<n+3?t.setRGB(0,0,0):t.setRGB(e[n]/255,e[n+1]/255,e[n+2]/255),Mn=(e,t,n=0)=>(t.r=(e[n]??0)/255,t.g=(e[n+1]??0)/255,t.b=(e[n+2]??0)/255,t),Nn=(e,t=1,n=0)=>{if(!e||e.length===0)return t;let r=e.length===1?0:n;return e.length<=r?t:e[r]/255},Pn=e=>e?e.length===On.COLORS_RGB:!1,Fn=e=>!e||e.length===0||Pn(e)?!1:e.length%On.COLORS_RGB===0,In=e=>e*.001,Ln=e=>{switch(e){case wn.RGB:return On.COLORS_RGB;default:return 0}},Rn=(e,t)=>{if(!t){e.boundingBox=null,e.boundingSphere=null;return}e.boundingBox??=new E,e.boundingBox.min.copy(t.min),e.boundingBox.max.copy(t.max),e.boundingSphere??=new pe,e.boundingSphere.center.copy(t.center),e.boundingSphere.radius=t.radius},zn=(e,t,n)=>{let r=new w;if(r.setAttribute(`position`,new C(e,3)),t?.colors){let e=Ln(t.colorFormat);r.setAttribute(`color`,new C(t.colors,e,!0))}return t?.opacities&&r.setAttribute(`opacity`,new C(t.opacities,1,!0)),n&&Rn(r,n),r},Bn=(e,t)=>{e.clearUpdateRanges(),e.addUpdateRange(0,t),e.needsUpdate=!0},Vn=(e,t)=>{if(t.colors){let n=Ln(t.colorFormat),r=e.getAttribute(`color`);r&&r.array.length>=t.colors.length?(r.array.set(t.colors,0),Bn(r,t.colors.length)):e.setAttribute(`color`,new C(t.colors,n,!0))}if(t.opacities){let n=e.getAttribute(`opacity`);n&&n.array.length>=t.opacities.length?(n.array.set(t.opacities,0),Bn(n,t.opacities.length)):e.setAttribute(`opacity`,new C(t.opacities,1,!0))}},Hn=(e,t,n,r)=>{let i=e.getAttribute(`position`);i&&i.array.length>=t.length?(i.array.set(t,0),e.setDrawRange(0,t.length/i.itemSize),Bn(i,t.length)):(e.setAttribute(`position`,new C(t,3)),e.setDrawRange(0,1/0)),Rn(e,r),Vn(e,n)},Un=(e,t,n)=>{let r=new w,i=new C(new Float32Array(e*t),t);if(r.setAttribute(`position`,i),n.colors){let t=Ln(n.colorFormat)||On.COLORS_RGB,i=new C(new Uint8Array(e*t),t,!0);r.setAttribute(`color`,i)}if(n.opacities){let t=new C(new Uint8Array(e),1,!0);r.setAttribute(`opacity`,t)}return r.setDrawRange(0,0),r},Wn=(e,t,n,r)=>{let i=t.length/3,a=e.getAttribute(`position`);if(a.array.set(t,n*3),a.addUpdateRange(n*3,i*3),a.needsUpdate=!0,r.colors){let t=e.getAttribute(`color`);if(t){let e=t.itemSize;t.array.set(r.colors,n*e),t.addUpdateRange(n*e,i*e),t.needsUpdate=!0}}if(r.opacities){let t=e.getAttribute(`opacity`);t&&(t.array.set(r.opacities,n),t.addUpdateRange(n,i),t.needsUpdate=!0)}let o=n+i;o>e.drawRange.count&&e.setDrawRange(0,o),e.boundingSphere=null},Gn=e=>{let t=e.type??``;if(t!==``)return t;let n=e.x??0,r=e.y??0,i=e.z??0;return Math.hypot(n,r,i)>0?`box`:(e.l??0)===0?(e.r??0)>0?`sphere`:``:`capsule`},Kn=1e-4,qn=new he(-1,0,0,0),Jn=new he(0,0,1,0),Yn=new he,Xn=new he,Zn=new he,Qn=new he,$n=new he,er=new D,tr=new D,nr=new D,rr=new D,ir=new D,ar=new D,or=new D,sr=new D,cr=(e,t,n)=>1-Math.abs(n/Math.hypot(e,t,n))<=Kn,lr=(e,t)=>e-t*Math.round(e/t),ur=class{isOrientationVector=!0;#e=`radians`;#t=new D;#n=0;#r;autoNormalize=!0;constructor(e=0,t=0,n=1,r=0){this.#t.set(e,t,n),this.autoNormalize&&this.#i(),this.#n=r}#i(){if(this.#t.lengthSq()===0){this.#t.set(0,0,1);return}this.#t.normalize()}get units(){return this.#e}get x(){return this.#t.x}set x(e){this.#t.setX(e),this.autoNormalize&&this.#i(),this.#r?.()}get y(){return this.#t.y}set y(e){this.#t.setY(e),this.autoNormalize&&this.#i(),this.#r?.()}get z(){return this.#t.z}set z(e){this.#t.setZ(e),this.autoNormalize&&this.#i(),this.#r?.()}get th(){return this.#e===`degrees`?T.radToDeg(this.#n):this.#n}set th(e){this.#n=this.#e===`degrees`?T.degToRad(e):e,this.#r?.()}get w(){return this.th}set w(e){this.th=e}_onChange(e){return this.#r=e,this}set(e=0,t=0,n=0,r=0){return this.#t.set(e,t,n),this.autoNormalize&&this.#i(),this.th=r,this.#r?.(),this}setUnits(e){return this.#e=e,this}length(){return this.#t.length()}normalize(){return this.#i(),this}copy(e){return this.#t.set(e.x,e.y,e.z),this.autoNormalize&&this.#i(),this.th=e.th,this.#r?.(),this}equals(e){return this.x===e.x&&this.y===e.y&&this.z===e.z&&this.th===e.th}fromArray(e,t=0){return this.#t.set(e[t]??0,e[t+1]??0,e[t+2]??0),this.th=e[t+3]??0,this.#r?.(),this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.th,e}toJson(){return this.toArray()}setFromQuaternion(e){let t=Yn.copy(e).conjugate(),n=Xn.multiplyQuaternions(e,qn).multiply(t),r=Zn.multiplyQuaternions(e,Jn).multiply(t),i=0;if(cr(r.x,r.y,r.z)){i=r.z<0?-Math.atan2(n.y,n.x):-Math.atan2(n.y,-n.x);let t=Math.atan2(r.y,r.x),a=Math.acos(T.clamp(r.z,-1,1)),o=Qn.set(0,0,Math.sin(t/2),Math.cos(t/2)).multiply($n.set(0,Math.sin(a/2),0,Math.cos(a/2))).conjugate().multiply(e),s=2*Math.atan2(o.z,o.w)+(r.z>0?t:-t);i+=lr(s-i,2*Math.PI)}else{let e=er.set(r.x,r.y,r.z),t=tr.set(n.x,n.y,n.z),a=nr.set(Jn.x,Jn.y,Jn.z),o=rr.copy(e).cross(t),s=ir.copy(e).cross(a),c=o.dot(s)/(o.length()*s.length()),l=T.clamp(c,-1,1),u=Math.acos(l);if(u>1e-4){let t=ar.copy(e).normalize(),n=Qn.setFromAxisAngle(t,-1*u),r=$n.copy(n).conjugate(),a=n.multiplyQuaternions(n.multiply(Jn),r),s=or.copy(e).cross(sr.set(a.x,a.y,a.z));i=1-o.dot(s)/(o.length()*s.length())<1e-4**2?-u:u}else i=0}return this.set(r.x,r.y,r.z,i),this.#r?.(),this}toQuaternion(e){let t=Math.acos(this.z),n=Math.atan2(this.y,this.x),r=this.th;cr(this.x,this.y,this.z)&&(r+=this.z>0?-n:n);let i=Math.sin(n/2),a=Math.cos(n/2),o=Math.sin(t/2),s=Math.cos(t/2),c=Math.sin(r/2),l=Math.cos(r/2);return e.set(a*o*c-i*o*l,a*o*l+i*o*c,i*s*l+a*s*c,a*s*l-i*s*c)}toEuler(e){return e.setFromQuaternion(this.toQuaternion(Yn),`ZYX`)}},dr=new re,fr=new D,pr=new ur,mr=(e,t)=>{let n=e?.value;if(n)switch(e?.type){case`quaternion`:{let e=n;return t.set(e.X??e.x??0,e.Y??e.y??0,e.Z??e.z??0,e.W??e.w??0).normalize(),!0}case`euler_angles`:{let e=n;return t.setFromEuler(dr.set(e.roll??0,e.pitch??0,e.yaw??0,`ZYX`)),!0}case`ov_radians`:{let e=n;return pr.set(e.x,e.y,e.z,e.th).toQuaternion(t),!0}case`ov_degrees`:{let e=n;return pr.set(e.x,e.y,e.z,T.degToRad(e.th??0)).toQuaternion(t),!0}case`axis_angles`:{let e=n;return fr.set(e.x,e.y,e.z),fr.lengthSq()>0?(t.setFromAxisAngle(fr.normalize(),e.th??0),!0):(console.warn(`[spatialJson] axis_angles has a zero axis — using identity`),t.set(0,0,0,1),!1)}}return e?.type&&console.warn(`[spatialJson] unhandled orientation "${e.type}" — using identity`),t.set(0,0,0,1),!1},L=new ur,hr=new he,gr=new D,_r=new D,vr=new re,yr=.001,br=1e3,xr=class e{x;y;z;oX;oY;oZ;theta;constructor(e=0,t=0,n=0,r,i,a,o=0){this.x=e,this.y=t,this.z=n,this.oX=r??0,this.oY=i??0,this.theta=o,this.oZ=r===void 0&&i===void 0&&a===void 0?1:a??0}equals(e){return e===this?!0:e?this.x===e.x&&this.y===e.y&&this.z===e.z&&this.oX===e.oX&&this.oY===e.oY&&this.oZ===e.oZ&&this.theta===e.theta:!1}clone(){return new e(this.x,this.y,this.z,this.oX,this.oY,this.oZ,this.theta)}copy(e){return this.x=e?.x??0,this.y=e?.y??0,this.z=e?.z??0,this.oX=e?.oX??0,this.oY=e?.oY??0,this.theta=e?.theta??0,this.oZ=e?.oX===void 0&&e?.oY===void 0&&e?.oZ===void 0?1:e?.oZ??0,this}merge(e){return e.x!==void 0&&(this.x=e.x),e.y!==void 0&&(this.y=e.y),e.z!==void 0&&(this.z=e.z),e.oX!==void 0&&(this.oX=e.oX),e.oY!==void 0&&(this.oY=e.oY),e.oZ!==void 0&&(this.oZ=e.oZ),e.theta!==void 0&&(this.theta=e.theta),this}isFinite(){return Number.isFinite(this.x)&&Number.isFinite(this.y)&&Number.isFinite(this.z)&&Number.isFinite(this.oX)&&Number.isFinite(this.oY)&&Number.isFinite(this.oZ)&&Number.isFinite(this.theta)}setFromFrame(e){let t=e.orientation;if(!t?.value)L.set(0,0,1,0);else if(t.type===`ov_degrees`||t.type===`ov_radians`){let{x:e,y:n,z:r,th:i}=t.value;L.set(e,n,r,t.type===`ov_radians`?i:T.degToRad(i??0))}else mr(t,hr),L.setFromQuaternion(hr);return this.x=e.translation?.x??0,this.y=e.translation?.y??0,this.z=e.translation?.z??0,this.oX=L.x,this.oY=L.y,this.oZ=L.z,this.theta=T.radToDeg(L.th),this}setFromQuaternion(e){return L.setFromQuaternion(e),this.oX=L.x,this.oY=L.y,this.oZ=L.z,this.theta=T.radToDeg(L.th),this}setFromVector3(e){return this.x=e.x*br,this.y=e.y*br,this.z=e.z*br,this}setFromObject3D(e){return this.setFromVector3(e.position),this.setFromQuaternion(e.quaternion),this}setFromMatrix4(e){return e.decompose(gr,hr,_r),this.x=gr.x*br,this.y=gr.y*br,this.z=gr.z*br,L.setFromQuaternion(hr),this.oX=L.x,this.oY=L.y,this.oZ=L.z,this.theta=T.radToDeg(L.th),this}toMatrix4(e=new O){return L.set(this.oX,this.oY,this.oZ,T.degToRad(this.theta)),L.toQuaternion(hr),e.makeRotationFromQuaternion(hr),e.setPosition(this.x*yr,this.y*yr,this.z*yr),e}toQuaternion(e=new he){return L.set(this.oX,this.oY,this.oZ,T.degToRad(this.theta)),L.toQuaternion(e),e}toEulerDegrees(){return this.toQuaternion(hr),vr.setFromQuaternion(hr,`ZYX`),{roll:T.radToDeg(vr.x),pitch:T.radToDeg(vr.y),yaw:T.radToDeg(vr.z)}}toVector3(e=new D){return e.set(this.x*yr,this.y*yr,this.z*yr),e}toObject3D(e=new v){return this.toQuaternion(e.quaternion),this.toVector3(e.position),e}},Sr=(e,t=``,n=new xr)=>({center:n,label:t,geometryType:e??{case:void 0,value:void 0}}),Cr=e=>{let t=e.x??0,n=e.y??0,r=e.z??0,i=e.r??0,a=e.l??0,o=new xr().setFromFrame(e);switch(Gn(e)){case`box`:return Sr({case:`box`,value:{dimsMm:{x:t,y:n,z:r}}},``,o);case`capsule`:return Sr({case:`capsule`,value:{radiusMm:i,lengthMm:a}},``,o);case`sphere`:return Sr({case:`sphere`,value:{radiusMm:i}},``,o);case``:return;default:console.warn(`[frame] geometry type "${e.type}" cannot be drawn — skipping it`);return}},wr=e=>{let t=e.geometry;if(t)switch(t.type){case`none`:return;case`box`:return Sr({case:`box`,value:{dimsMm:{x:t.x,y:t.y,z:t.z}}},``,new xr().setFromFrame(t));case`sphere`:return Sr({case:`sphere`,value:{radiusMm:t.r}},``,new xr().setFromFrame(t));case`capsule`:return Sr({case:`capsule`,value:{radiusMm:t.r,lengthMm:t.l}},``,new xr().setFromFrame(t));default:return Cr(t)}},Tr=e=>({x:e?.dimsMm?.x??0,y:e?.dimsMm?.y??0,z:e?.dimsMm?.z??0}),Er=e=>({r:e?.radiusMm??0,l:e?.lengthMm??0}),Dr=e=>({r:e?.radiusMm??0}),Or=e=>({r:e?.radiusMm??0,l:e?.lengthMm??0,capped:e?.capped??!0}),kr=e=>e?.case===`pointcloud`,Ar=1e6,jr=new Blob([`"use strict";(()=>{var ss=1;var rs=3,as=0;var os=1;var ls=100;var cs=204,hs=205;var Hn=0,Wn=1,Xn=2,Ze=3,qn=4,Yn=5,Zn=6,Jn=7,us=0,fs=1,ds=2;var fi=1,di=2,pi=3,mi=4,gi=5,_i=6,xi=7;var yi=300;var ps=302;var $n=1e3,ye=1001,Kn=1002;var ms=1006;var gs=1008;var _s=1009;var xs=1015;var ys=1023;var Se=2300,Je=2301,We=2302,Qn=2303,jn=2400,ti=2401,ei=2402;var vi="",J="srgb",ni="srgb-linear",ii="linear",Xe="srgb";var qe=7680;var vs=519;var Ss=35044;var ve=2e3,si=2001;function Ys(h){for(let t=h.length-1;t>=0;--t)if(h[t]>=65535)return!0;return!1}function Zs(h){return ArrayBuffer.isView(h)&&!(h instanceof DataView)}function ri(h){return document.createElementNS("http://www.w3.org/1999/xhtml",h)}var Gi={},$e=null;function Ms(h){let t=h[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=h[1];e&&e.isStackTrace?h[0]+=" "+e.getLocation():h[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return h}function G(...h){h=Ms(h);let t="THREE."+h.shift();if($e)$e("warn",t,...h);else{let e=h[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...h)}}function B(...h){h=Ms(h);let t="THREE."+h.shift();if($e)$e("error",t,...h);else{let e=h[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...h)}}function Ye(...h){let t=h.join(" ");t in Gi||(Gi[t]=!0,G(...h))}var Js={[Hn]:Hn,[Xn]:Zn,[qn]:qn,[Ze]:Yn,[Wn]:Wn,[Zn]:Xn,[Jn]:Jn,[Yn]:Ze},It=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let i=n[t];if(i!==void 0){let s=i.indexOf(e);s!==-1&&i.splice(s,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let i=n.slice(0);for(let s=0,r=i.length;s<r;s++)i[s].call(this,t);t.target=null}}},Y=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var wl=Math.PI/180,$s=180/Math.PI;function Re(){let h=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Y[h&255]+Y[h>>8&255]+Y[h>>16&255]+Y[h>>24&255]+"-"+Y[t&255]+Y[t>>8&255]+"-"+Y[t>>16&15|64]+Y[t>>24&255]+"-"+Y[e&63|128]+Y[e>>8&255]+"-"+Y[e>>16&255]+Y[e>>24&255]+Y[n&255]+Y[n>>8&255]+Y[n>>16&255]+Y[n>>24&255]).toLowerCase()}function F(h,t,e){return Math.max(t,Math.min(e,h))}function Ks(h,t){return(h%t+t)%t}function In(h,t,e){return(1-e)*h+e*t}function Si(h){switch(h.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function Qs(h,t){if(t.constructor===Float32Array)return h;let e=Si(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.max(h/e,-1)}function js(h,t){if(t.constructor===Float32Array)return h;let e=Si(t);if(e===void 0)throw new Error("THREE.MathUtils: Invalid component type.");return Math.round(h*e)}var q=class{static{this.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=F(this.x,t.x,e.x),this.y=F(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=F(this.x,t,e),this.y=F(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(F(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(F(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),i=Math.sin(e),s=this.x-t.x,r=this.y-t.y;return this.x=s*n-r*i+t.x,this.y=s*i+r*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},St=class{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,s,r,a){let l=n[i+0],o=n[i+1],c=n[i+2],u=n[i+3],p=s[r+0],d=s[r+1],f=s[r+2],m=s[r+3];if(u!==m||l!==p||o!==d||c!==f){let _=l*p+o*d+c*f+u*m;_<0&&(p=-p,d=-d,f=-f,m=-m,_=-_);let g=1-a;if(_<.9995){let y=Math.acos(_),x=Math.sin(y);g=Math.sin(g*y)/x,a=Math.sin(a*y)/x,l=l*g+p*a,o=o*g+d*a,c=c*g+f*a,u=u*g+m*a}else{l=l*g+p*a,o=o*g+d*a,c=c*g+f*a,u=u*g+m*a;let y=1/Math.sqrt(l*l+o*o+c*c+u*u);l*=y,o*=y,c*=y,u*=y}}t[e]=l,t[e+1]=o,t[e+2]=c,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,s,r){let a=n[i],l=n[i+1],o=n[i+2],c=n[i+3],u=s[r],p=s[r+1],d=s[r+2],f=s[r+3];return t[e]=a*f+c*u+l*d-o*p,t[e+1]=l*f+c*p+o*u-a*d,t[e+2]=o*f+c*d+a*p-l*u,t[e+3]=c*f-a*u-l*p-o*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,i=t._y,s=t._z,r=t._order,a=Math.cos,l=Math.sin,o=a(n/2),c=a(i/2),u=a(s/2),p=l(n/2),d=l(i/2),f=l(s/2);switch(r){case"XYZ":this._x=p*c*u+o*d*f,this._y=o*d*u-p*c*f,this._z=o*c*f+p*d*u,this._w=o*c*u-p*d*f;break;case"YXZ":this._x=p*c*u+o*d*f,this._y=o*d*u-p*c*f,this._z=o*c*f-p*d*u,this._w=o*c*u+p*d*f;break;case"ZXY":this._x=p*c*u-o*d*f,this._y=o*d*u+p*c*f,this._z=o*c*f+p*d*u,this._w=o*c*u-p*d*f;break;case"ZYX":this._x=p*c*u-o*d*f,this._y=o*d*u+p*c*f,this._z=o*c*f-p*d*u,this._w=o*c*u+p*d*f;break;case"YZX":this._x=p*c*u+o*d*f,this._y=o*d*u+p*c*f,this._z=o*c*f-p*d*u,this._w=o*c*u-p*d*f;break;case"XZY":this._x=p*c*u-o*d*f,this._y=o*d*u-p*c*f,this._z=o*c*f+p*d*u,this._w=o*c*u+p*d*f;break;default:G("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],i=e[4],s=e[8],r=e[1],a=e[5],l=e[9],o=e[2],c=e[6],u=e[10],p=n+a+u;if(p>0){let d=.5/Math.sqrt(p+1);this._w=.25/d,this._x=(c-l)*d,this._y=(s-o)*d,this._z=(r-i)*d}else if(n>a&&n>u){let d=2*Math.sqrt(1+n-a-u);this._w=(c-l)/d,this._x=.25*d,this._y=(i+r)/d,this._z=(s+o)/d}else if(a>u){let d=2*Math.sqrt(1+a-n-u);this._w=(s-o)/d,this._x=(i+r)/d,this._y=.25*d,this._z=(l+c)/d}else{let d=2*Math.sqrt(1+u-n-a);this._w=(r-i)/d,this._x=(s+o)/d,this._y=(l+c)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(F(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,i=t._y,s=t._z,r=t._w,a=e._x,l=e._y,o=e._z,c=e._w;return this._x=n*c+r*a+i*o-s*l,this._y=i*c+r*l+s*a-n*o,this._z=s*c+r*o+n*l-i*a,this._w=r*c-n*a-i*l-s*o,this._onChangeCallback(),this}slerp(t,e){let n=t._x,i=t._y,s=t._z,r=t._w,a=this.dot(t);a<0&&(n=-n,i=-i,s=-s,r=-r,a=-a);let l=1-e;if(a<.9995){let o=Math.acos(a),c=Math.sin(o);l=Math.sin(l*o)/c,e=Math.sin(e*o)/c,this._x=this._x*l+n*e,this._y=this._y*l+i*e,this._z=this._z*l+s*e,this._w=this._w*l+r*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+i*e,this._z=this._z*l+s*e,this._w=this._w*l+r*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),s*Math.sin(e),s*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},E=class{static{this.prototype.isVector3=!0}constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(ki.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(ki.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6]*i,this.y=s[1]*e+s[4]*n+s[7]*i,this.z=s[2]*e+s[5]*n+s[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,i=this.z,s=t.elements,r=1/(s[3]*e+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*e+s[4]*n+s[8]*i+s[12])*r,this.y=(s[1]*e+s[5]*n+s[9]*i+s[13])*r,this.z=(s[2]*e+s[6]*n+s[10]*i+s[14])*r,this}applyQuaternion(t){let e=this.x,n=this.y,i=this.z,s=t.x,r=t.y,a=t.z,l=t.w,o=2*(r*i-a*n),c=2*(a*e-s*i),u=2*(s*n-r*e);return this.x=e+l*o+r*u-a*c,this.y=n+l*c+a*o-s*u,this.z=i+l*u+s*c-r*o,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[4]*n+s[8]*i,this.y=s[1]*e+s[5]*n+s[9]*i,this.z=s[2]*e+s[6]*n+s[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=F(this.x,t.x,e.x),this.y=F(this.y,t.y,e.y),this.z=F(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=F(this.x,t,e),this.y=F(this.y,t,e),this.z=F(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(F(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,i=t.y,s=t.z,r=e.x,a=e.y,l=e.z;return this.x=i*l-s*a,this.y=s*r-n*l,this.z=n*a-i*r,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ln.copy(this).projectOnVector(t),this.sub(Ln)}reflect(t){return this.sub(Ln.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(F(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ln=new E,ki=new St,N=class{static{this.prototype.isMatrix3=!0}constructor(t,e,n,i,s,r,a,l,o){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,r,a,l,o)}set(t,e,n,i,s,r,a,l,o){let c=this.elements;return c[0]=t,c[1]=i,c[2]=a,c[3]=e,c[4]=s,c[5]=l,c[6]=n,c[7]=r,c[8]=o,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,i=e.elements,s=this.elements,r=n[0],a=n[3],l=n[6],o=n[1],c=n[4],u=n[7],p=n[2],d=n[5],f=n[8],m=i[0],_=i[3],g=i[6],y=i[1],x=i[4],v=i[7],S=i[2],A=i[5],b=i[8];return s[0]=r*m+a*y+l*S,s[3]=r*_+a*x+l*A,s[6]=r*g+a*v+l*b,s[1]=o*m+c*y+u*S,s[4]=o*_+c*x+u*A,s[7]=o*g+c*v+u*b,s[2]=p*m+d*y+f*S,s[5]=p*_+d*x+f*A,s[8]=p*g+d*v+f*b,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],r=t[4],a=t[5],l=t[6],o=t[7],c=t[8];return e*r*c-e*a*o-n*s*c+n*a*l+i*s*o-i*r*l}invert(){let t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],r=t[4],a=t[5],l=t[6],o=t[7],c=t[8],u=c*r-a*o,p=a*l-c*s,d=o*s-r*l,f=e*u+n*p+i*d;if(f===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/f;return t[0]=u*m,t[1]=(i*o-c*n)*m,t[2]=(a*n-i*r)*m,t[3]=p*m,t[4]=(c*e-i*l)*m,t[5]=(i*s-a*e)*m,t[6]=d*m,t[7]=(n*l-o*e)*m,t[8]=(r*e-n*s)*m,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,s,r,a){let l=Math.cos(s),o=Math.sin(s);return this.set(n*l,n*o,-n*(l*r+o*a)+r+t,-i*o,i*l,-i*(-o*r+l*a)+a+e,0,0,1),this}scale(t,e){return Ye("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Dn.makeScale(t,e)),this}rotate(t){return Ye("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Dn.makeRotation(-t)),this}translate(t,e){return Ye("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Dn.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Dn=new N,Hi=new N().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Wi=new N().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function tr(){let h={enabled:!0,workingColorSpace:ni,spaces:{},convert:function(i,s,r){return this.enabled===!1||s===r||!s||!r||(this.spaces[s].transfer===Xe&&(i.r=vt(i.r),i.g=vt(i.g),i.b=vt(i.b)),this.spaces[s].primaries!==this.spaces[r].primaries&&(i.applyMatrix3(this.spaces[s].toXYZ),i.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===Xe&&(i.r=te(i.r),i.g=te(i.g),i.b=te(i.b))),i},workingToColorSpace:function(i,s){return this.convert(i,this.workingColorSpace,s)},colorSpaceToWorking:function(i,s){return this.convert(i,s,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===vi?ii:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,s=this.workingColorSpace){return i.fromArray(this.spaces[s].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,s,r){return i.copy(this.spaces[r].fromXYZ).multiply(this.spaces[s].toXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return h.define({[ni]:{primaries:t,whitePoint:n,transfer:ii,toXYZ:Hi,fromXYZ:Wi,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:J},outputColorSpaceConfig:{drawingBufferColorSpace:J}},[J]:{primaries:t,whitePoint:n,transfer:Xe,toXYZ:Hi,fromXYZ:Wi,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:J}}}),h}var lt=tr();function vt(h){return h<.04045?h*.0773993808:Math.pow(h*.9478672986+.0521327014,2.4)}function te(h){return h<.0031308?h*12.92:1.055*Math.pow(h,.41666)-.055}var Xt,Ke=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{Xt===void 0&&(Xt=ri("canvas")),Xt.width=t.width,Xt.height=t.height;let i=Xt.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),n=Xt}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=ri("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let i=n.getImageData(0,0,t.width,t.height),s=i.data;for(let r=0;r<s.length;r++)s[r]=vt(s[r]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(vt(e[n]/255)*255):e[n]=vt(e[n]);return{data:e,width:t.width,height:t.height}}else return G("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},er=0,Qe=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:er++}),this.uuid=Re(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width||0,e.height||0,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let r=0,a=i.length;r<a;r++)i[r].isDataTexture?s.push(Nn(i[r].image)):s.push(Nn(i[r]))}else s=Nn(i);n.url=s}return e||(t.images[this.uuid]=n),n}};function Nn(h){return typeof HTMLImageElement<"u"&&h instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&h instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&h instanceof ImageBitmap?Ke.getDataURL(h):h.data?{data:Array.from(h.data),width:h.width,height:h.height,type:h.data.constructor.name}:(G("Texture: Unable to serialize Texture."),{})}var nr=0,Un=new E,ee=class h extends It{constructor(t=h.DEFAULT_IMAGE,e=h.DEFAULT_MAPPING,n=ye,i=ye,s=ms,r=gs,a=ys,l=_s,o=h.DEFAULT_ANISOTROPY,c=vi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:nr++}),this.uuid=Re(),this.name="",this.source=new Qe(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=r,this.anisotropy=o,this.format=a,this.internalFormat=null,this.type=l,this.offset=new q(0,0),this.repeat=new q(1,1),this.center=new q(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new N,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=c,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(Un).x}get height(){return this.source.getSize(Un).y}get depth(){return this.source.getSize(Un).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.mipmapsAutoUpdate=t.mipmapsAutoUpdate,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isPMREMTexture=t.isPMREMTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){G(\`Texture.setValues(): parameter '\${e}' has value of undefined.\`);continue}let i=this[e];if(i===void 0){G(\`Texture.setValues(): property '\${e}' does not exist.\`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==yi)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case $n:t.x=t.x-Math.floor(t.x);break;case ye:t.x=t.x<0?0:1;break;case Kn:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case $n:t.y=t.y-Math.floor(t.y);break;case ye:t.y=t.y<0?0:1;break;case Kn:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};ee.DEFAULT_IMAGE=null;ee.DEFAULT_MAPPING=yi;ee.DEFAULT_ANISOTROPY=1;var ai=class{static{this.prototype.isVector4=!0}constructor(t=0,e=0,n=0,i=1){this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,i=this.z,s=this.w,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i+r[12]*s,this.y=r[1]*e+r[5]*n+r[9]*i+r[13]*s,this.z=r[2]*e+r[6]*n+r[10]*i+r[14]*s,this.w=r[3]*e+r[7]*n+r[11]*i+r[15]*s,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,s,l=t.elements,o=l[0],c=l[4],u=l[8],p=l[1],d=l[5],f=l[9],m=l[2],_=l[6],g=l[10];if(Math.abs(c-p)<.01&&Math.abs(u-m)<.01&&Math.abs(f-_)<.01){if(Math.abs(c+p)<.1&&Math.abs(u+m)<.1&&Math.abs(f+_)<.1&&Math.abs(o+d+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let x=(o+1)/2,v=(d+1)/2,S=(g+1)/2,A=(c+p)/4,b=(u+m)/4,w=(f+_)/4;return x>v&&x>S?x<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(x),i=A/n,s=b/n):v>S?v<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(v),n=A/i,s=w/i):S<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(S),n=b/s,i=w/s),this.set(n,i,s,e),this}let y=Math.sqrt((_-f)*(_-f)+(u-m)*(u-m)+(p-c)*(p-c));return Math.abs(y)<.001&&(y=1),this.x=(_-f)/y,this.y=(u-m)/y,this.z=(p-c)/y,this.w=Math.acos((o+d+g-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=F(this.x,t.x,e.x),this.y=F(this.y,t.y,e.y),this.z=F(this.z,t.z,e.z),this.w=F(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=F(this.x,t,e),this.y=F(this.y,t,e),this.z=F(this.z,t,e),this.w=F(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(F(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};var K=class h{static{this.prototype.isMatrix4=!0}constructor(t,e,n,i,s,r,a,l,o,c,u,p,d,f,m,_){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,r,a,l,o,c,u,p,d,f,m,_)}set(t,e,n,i,s,r,a,l,o,c,u,p,d,f,m,_){let g=this.elements;return g[0]=t,g[4]=e,g[8]=n,g[12]=i,g[1]=s,g[5]=r,g[9]=a,g[13]=l,g[2]=o,g[6]=c,g[10]=u,g[14]=p,g[3]=d,g[7]=f,g[11]=m,g[15]=_,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new h().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,i=1/qt.setFromMatrixColumn(t,0).length(),s=1/qt.setFromMatrixColumn(t,1).length(),r=1/qt.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*s,e[5]=n[5]*s,e[6]=n[6]*s,e[7]=0,e[8]=n[8]*r,e[9]=n[9]*r,e[10]=n[10]*r,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,i=t.y,s=t.z,r=Math.cos(n),a=Math.sin(n),l=Math.cos(i),o=Math.sin(i),c=Math.cos(s),u=Math.sin(s);if(t.order==="XYZ"){let p=r*c,d=r*u,f=a*c,m=a*u;e[0]=l*c,e[4]=-l*u,e[8]=o,e[1]=d+f*o,e[5]=p-m*o,e[9]=-a*l,e[2]=m-p*o,e[6]=f+d*o,e[10]=r*l}else if(t.order==="YXZ"){let p=l*c,d=l*u,f=o*c,m=o*u;e[0]=p+m*a,e[4]=f*a-d,e[8]=r*o,e[1]=r*u,e[5]=r*c,e[9]=-a,e[2]=d*a-f,e[6]=m+p*a,e[10]=r*l}else if(t.order==="ZXY"){let p=l*c,d=l*u,f=o*c,m=o*u;e[0]=p-m*a,e[4]=-r*u,e[8]=f+d*a,e[1]=d+f*a,e[5]=r*c,e[9]=m-p*a,e[2]=-r*o,e[6]=a,e[10]=r*l}else if(t.order==="ZYX"){let p=r*c,d=r*u,f=a*c,m=a*u;e[0]=l*c,e[4]=f*o-d,e[8]=p*o+m,e[1]=l*u,e[5]=m*o+p,e[9]=d*o-f,e[2]=-o,e[6]=a*l,e[10]=r*l}else if(t.order==="YZX"){let p=r*l,d=r*o,f=a*l,m=a*o;e[0]=l*c,e[4]=m-p*u,e[8]=f*u+d,e[1]=u,e[5]=r*c,e[9]=-a*c,e[2]=-o*c,e[6]=d*u+f,e[10]=p-m*u}else if(t.order==="XZY"){let p=r*l,d=r*o,f=a*l,m=a*o;e[0]=l*c,e[4]=-u,e[8]=o*c,e[1]=p*u+m,e[5]=r*c,e[9]=d*u-f,e[2]=f*u-d,e[6]=a*c,e[10]=m*u+p}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(ir,t,sr)}lookAt(t,e,n){let i=this.elements;return tt.subVectors(t,e),tt.lengthSq()===0&&(tt.z=1),tt.normalize(),wt.crossVectors(n,tt),wt.lengthSq()===0&&(Math.abs(n.z)===1?tt.x+=1e-4:tt.z+=1e-4,tt.normalize(),wt.crossVectors(n,tt)),wt.normalize(),Le.crossVectors(tt,wt),i[0]=wt.x,i[4]=Le.x,i[8]=tt.x,i[1]=wt.y,i[5]=Le.y,i[9]=tt.y,i[2]=wt.z,i[6]=Le.z,i[10]=tt.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,i=e.elements,s=this.elements,r=n[0],a=n[4],l=n[8],o=n[12],c=n[1],u=n[5],p=n[9],d=n[13],f=n[2],m=n[6],_=n[10],g=n[14],y=n[3],x=n[7],v=n[11],S=n[15],A=i[0],b=i[4],w=i[8],M=i[12],C=i[1],P=i[5],T=i[9],L=i[13],D=i[2],I=i[6],H=i[10],at=i[14],ut=i[3],Et=i[7],Tt=i[11],Wt=i[15];return s[0]=r*A+a*C+l*D+o*ut,s[4]=r*b+a*P+l*I+o*Et,s[8]=r*w+a*T+l*H+o*Tt,s[12]=r*M+a*L+l*at+o*Wt,s[1]=c*A+u*C+p*D+d*ut,s[5]=c*b+u*P+p*I+d*Et,s[9]=c*w+u*T+p*H+d*Tt,s[13]=c*M+u*L+p*at+d*Wt,s[2]=f*A+m*C+_*D+g*ut,s[6]=f*b+m*P+_*I+g*Et,s[10]=f*w+m*T+_*H+g*Tt,s[14]=f*M+m*L+_*at+g*Wt,s[3]=y*A+x*C+v*D+S*ut,s[7]=y*b+x*P+v*I+S*Et,s[11]=y*w+x*T+v*H+S*Tt,s[15]=y*M+x*L+v*at+S*Wt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],i=t[8],s=t[12],r=t[1],a=t[5],l=t[9],o=t[13],c=t[2],u=t[6],p=t[10],d=t[14],f=t[3],m=t[7],_=t[11],g=t[15],y=l*d-o*p,x=a*d-o*u,v=a*p-l*u,S=r*d-o*c,A=r*p-l*c,b=r*u-a*c;return e*(m*y-_*x+g*v)-n*(f*y-_*S+g*A)+i*(f*x-m*S+g*b)-s*(f*v-m*A+_*b)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],i=t[8],s=t[1],r=t[5],a=t[9],l=t[2],o=t[6],c=t[10];return e*(r*c-a*o)-n*(s*c-a*l)+i*(s*o-r*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],r=t[4],a=t[5],l=t[6],o=t[7],c=t[8],u=t[9],p=t[10],d=t[11],f=t[12],m=t[13],_=t[14],g=t[15],y=e*a-n*r,x=e*l-i*r,v=e*o-s*r,S=n*l-i*a,A=n*o-s*a,b=i*o-s*l,w=c*m-u*f,M=c*_-p*f,C=c*g-d*f,P=u*_-p*m,T=u*g-d*m,L=p*g-d*_,D=y*L-x*T+v*P+S*C-A*M+b*w;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let I=1/D;return t[0]=(a*L-l*T+o*P)*I,t[1]=(i*T-n*L-s*P)*I,t[2]=(m*b-_*A+g*S)*I,t[3]=(p*A-u*b-d*S)*I,t[4]=(l*C-r*L-o*M)*I,t[5]=(e*L-i*C+s*M)*I,t[6]=(_*v-f*b-g*x)*I,t[7]=(c*b-p*v+d*x)*I,t[8]=(r*T-a*C+o*w)*I,t[9]=(n*C-e*T-s*w)*I,t[10]=(f*A-m*v+g*y)*I,t[11]=(u*v-c*A-d*y)*I,t[12]=(a*M-r*P-l*w)*I,t[13]=(e*P-n*M+i*w)*I,t[14]=(m*x-f*S-_*y)*I,t[15]=(c*S-u*x+p*y)*I,this}scale(t){let e=this.elements,n=t.x,i=t.y,s=t.z;return e[0]*=n,e[4]*=i,e[8]*=s,e[1]*=n,e[5]*=i,e[9]*=s,e[2]*=n,e[6]*=i,e[10]*=s,e[3]*=n,e[7]*=i,e[11]*=s,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),i=Math.sin(e),s=1-n,r=t.x,a=t.y,l=t.z,o=s*r,c=s*a;return this.set(o*r+n,o*a-i*l,o*l+i*a,0,o*a+i*l,c*a+n,c*l-i*r,0,o*l-i*a,c*l+i*r,s*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,s,r){return this.set(1,n,s,0,t,1,r,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){let i=this.elements,s=e._x,r=e._y,a=e._z,l=e._w,o=s+s,c=r+r,u=a+a,p=s*o,d=s*c,f=s*u,m=r*c,_=r*u,g=a*u,y=l*o,x=l*c,v=l*u,S=n.x,A=n.y,b=n.z;return i[0]=(1-(m+g))*S,i[1]=(d+v)*S,i[2]=(f-x)*S,i[3]=0,i[4]=(d-v)*A,i[5]=(1-(p+g))*A,i[6]=(_+y)*A,i[7]=0,i[8]=(f+x)*b,i[9]=(_-y)*b,i[10]=(1-(p+m))*b,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){let i=this.elements;t.x=i[12],t.y=i[13],t.z=i[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),e.identity(),this;let r=qt.set(i[0],i[1],i[2]).length(),a=qt.set(i[4],i[5],i[6]).length(),l=qt.set(i[8],i[9],i[10]).length();s<0&&(r=-r),ft.copy(this);let o=1/r,c=1/a,u=1/l;return ft.elements[0]*=o,ft.elements[1]*=o,ft.elements[2]*=o,ft.elements[4]*=c,ft.elements[5]*=c,ft.elements[6]*=c,ft.elements[8]*=u,ft.elements[9]*=u,ft.elements[10]*=u,e.setFromRotationMatrix(ft),n.x=r,n.y=a,n.z=l,this}makePerspective(t,e,n,i,s,r,a=ve,l=!1){let o=this.elements,c=2*s/(e-t),u=2*s/(n-i),p=(e+t)/(e-t),d=(n+i)/(n-i),f,m;if(l)f=s/(r-s),m=r*s/(r-s);else if(a===ve)f=-(r+s)/(r-s),m=-2*r*s/(r-s);else if(a===si)f=-r/(r-s),m=-r*s/(r-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return o[0]=c,o[4]=0,o[8]=p,o[12]=0,o[1]=0,o[5]=u,o[9]=d,o[13]=0,o[2]=0,o[6]=0,o[10]=f,o[14]=m,o[3]=0,o[7]=0,o[11]=-1,o[15]=0,this}makeOrthographic(t,e,n,i,s,r,a=ve,l=!1){let o=this.elements,c=2/(e-t),u=2/(n-i),p=-(e+t)/(e-t),d=-(n+i)/(n-i),f,m;if(l)f=1/(r-s),m=r/(r-s);else if(a===ve)f=-2/(r-s),m=-(r+s)/(r-s);else if(a===si)f=-1/(r-s),m=-s/(r-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return o[0]=c,o[4]=0,o[8]=0,o[12]=p,o[1]=0,o[5]=u,o[9]=0,o[13]=d,o[2]=0,o[6]=0,o[10]=f,o[14]=m,o[3]=0,o[7]=0,o[11]=0,o[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},qt=new E,ft=new K,ir=new E(0,0,0),sr=new E(1,1,1),wt=new E,Le=new E,tt=new E,Xi=new K,qi=new St,Me=class h{constructor(t=0,e=0,n=0,i=h.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let i=t.elements,s=i[0],r=i[4],a=i[8],l=i[1],o=i[5],c=i[9],u=i[2],p=i[6],d=i[10];switch(e){case"XYZ":this._y=Math.asin(F(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-c,d),this._z=Math.atan2(-r,s)):(this._x=Math.atan2(p,o),this._z=0);break;case"YXZ":this._x=Math.asin(-F(c,-1,1)),Math.abs(c)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,o)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(F(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-r,o)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-F(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(p,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-r,o));break;case"YZX":this._z=Math.asin(F(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-c,o),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-F(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(p,o),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-c,d),this._y=0);break;default:G("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Xi.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Xi,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return qi.setFromEuler(this),this.setFromQuaternion(qi,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Me.DEFAULT_ORDER="XYZ";var je=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},rr=0,Yi=new E,Yt=new St,gt=new K,De=new E,me=new E,ar=new E,or=new St,Zi=new E(1,0,0),Ji=new E(0,1,0),$i=new E(0,0,1),Ki={type:"added"},lr={type:"removed"},Zt={type:"childadded",child:null},Fn={type:"childremoved",child:null},Lt=class h extends It{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:rr++}),this.uuid=Re(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=h.DEFAULT_UP.clone();let t=new E,e=new Me,n=new St,i=new E(1,1,1);function s(){n.setFromEuler(e,!1)}function r(){e.setFromQuaternion(n,void 0,!1)}e._onChange(s),n._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new K},normalMatrix:{value:new N}}),this.matrix=new K,this.matrixWorld=new K,this.matrixAutoUpdate=h.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=h.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new je,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Yt.setFromAxisAngle(t,e),this.quaternion.multiply(Yt),this}rotateOnWorldAxis(t,e){return Yt.setFromAxisAngle(t,e),this.quaternion.premultiply(Yt),this}rotateX(t){return this.rotateOnAxis(Zi,t)}rotateY(t){return this.rotateOnAxis(Ji,t)}rotateZ(t){return this.rotateOnAxis($i,t)}translateOnAxis(t,e){return Yi.copy(t).applyQuaternion(this.quaternion),this.position.add(Yi.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Zi,t)}translateY(t){return this.translateOnAxis(Ji,t)}translateZ(t){return this.translateOnAxis($i,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(gt.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?De.copy(t):De.set(t,e,n);let i=this.parent;this.updateWorldMatrix(!0,!1),me.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?gt.lookAt(me,De,this.up):gt.lookAt(De,me,this.up),this.quaternion.setFromRotationMatrix(gt),i&&(gt.extractRotation(i.matrixWorld),Yt.setFromRotationMatrix(gt),this.quaternion.premultiply(Yt.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(B("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Ki),Zt.child=t,this.dispatchEvent(Zt),Zt.child=null):B("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(lr),Fn.child=t,this.dispatchEvent(Fn),Fn.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),gt.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),gt.multiply(t.parent.matrixWorld)),t.applyMatrix4(gt),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Ki),Zt.child=t,this.dispatchEvent(Zt),Zt.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){let r=this.children[n].getObjectByProperty(t,e);if(r!==void 0)return r}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let i=this.children;for(let s=0,r=i.length;s<r;s++)i[s].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(me,t,ar),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(me,or,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(t){t(this);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,i=t.z,s=this.matrix.elements;s[12]+=e-s[0]*e-s[4]*n-s[8]*i,s[13]+=n-s[1]*e-s[5]*n-s[9]*i,s[14]+=i-s[2]*e-s[6]*n-s[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let i=this.parent;if(t===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(a=>({...a})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(t),i.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let o=0,c=l.length;o<c;o++){let u=l[o];s(t.shapes,u)}else s(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,o=this.material.length;l<o;l++)a.push(s(t.materials,this.material[l]));i.material=a}else i.material=s(t.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(s(t.animations,l))}}if(e){let a=r(t.geometries),l=r(t.materials),o=r(t.textures),c=r(t.images),u=r(t.shapes),p=r(t.skeletons),d=r(t.animations),f=r(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),o.length>0&&(n.textures=o),c.length>0&&(n.images=c),u.length>0&&(n.shapes=u),p.length>0&&(n.skeletons=p),d.length>0&&(n.animations=d),f.length>0&&(n.nodes=f)}return n.object=i,n;function r(a){let l=[];for(let o in a){let c=a[o];delete c.metadata,l.push(c)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let i=t.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Lt.DEFAULT_UP=new E(0,1,0);Lt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var bs={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Rt={h:0,s:0,l:0},Ne={h:0,s:0,l:0};function On(h,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?h+(t-h)*6*e:e<1/2?t:e<2/3?h+(t-h)*6*(2/3-e):h}var z=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=J){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,lt.colorSpaceToWorking(this,e),this}setRGB(t,e,n,i=lt.workingColorSpace){return this.r=t,this.g=e,this.b=n,lt.colorSpaceToWorking(this,i),this}setHSL(t,e,n,i=lt.workingColorSpace){if(t=Ks(t,1),e=F(e,0,1),n=F(n,0,1),e===0)this.r=this.g=this.b=n;else{let s=n<=.5?n*(1+e):n+e-n*e,r=2*n-s;this.r=On(r,s,t+1/3),this.g=On(r,s,t),this.b=On(r,s,t-1/3)}return lt.colorSpaceToWorking(this,i),this}setStyle(t,e=J){function n(s){s!==void 0&&parseFloat(s)<1&&G("Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\\w+)\\(([^\\)]*)\\)/.exec(t)){let s,r=i[1],a=i[2];switch(r){case"rgb":case"rgba":if(s=/^\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,e);if(s=/^\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\%\\s*,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\%\\s*,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\%\\s*(?:,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(100,parseFloat(s[1]))/100,Math.min(100,parseFloat(s[2]))/100,Math.min(100,parseFloat(s[3]))/100,e);break;case"hsl":case"hsla":if(s=/^\\s*([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\%\\s*,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\%\\s*(?:,\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*)?$/.exec(a))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,e);break;default:G("Color: Unknown color model "+t)}}else if(i=/^\\#([A-Fa-f\\d]+)$/.exec(t)){let s=i[1],r=s.length;if(r===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,e);if(r===6)return this.setHex(parseInt(s,16),e);G("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=J){let n=bs[t.toLowerCase()];return n!==void 0?this.setHex(n,e):G("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=vt(t.r),this.g=vt(t.g),this.b=vt(t.b),this}copyLinearToSRGB(t){return this.r=te(t.r),this.g=te(t.g),this.b=te(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=J){return lt.workingToColorSpace(Z.copy(this),t),Math.round(F(Z.r*255,0,255))*65536+Math.round(F(Z.g*255,0,255))*256+Math.round(F(Z.b*255,0,255))}getHexString(t=J){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=lt.workingColorSpace){lt.workingToColorSpace(Z.copy(this),e);let n=Z.r,i=Z.g,s=Z.b,r=Math.max(n,i,s),a=Math.min(n,i,s),l,o,c=(a+r)/2;if(a===r)l=0,o=0;else{let u=r-a;switch(o=c<=.5?u/(r+a):u/(2-r-a),r){case n:l=(i-s)/u+(i<s?6:0);break;case i:l=(s-n)/u+2;break;case s:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=o,t.l=c,t}getRGB(t,e=lt.workingColorSpace){return lt.workingToColorSpace(Z.copy(this),e),t.r=Z.r,t.g=Z.g,t.b=Z.b,t}getStyle(t=J){lt.workingToColorSpace(Z.copy(this),t);let e=Z.r,n=Z.g,i=Z.b;return t!==J?\`color(\${t} \${e.toFixed(3)} \${n.toFixed(3)} \${i.toFixed(3)})\`:\`rgb(\${Math.round(e*255)},\${Math.round(n*255)},\${Math.round(i*255)})\`}offsetHSL(t,e,n){return this.getHSL(Rt),this.setHSL(Rt.h+t,Rt.s+e,Rt.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Rt),t.getHSL(Ne);let n=In(Rt.h,Ne.h,e),i=In(Rt.s,Ne.s,e),s=In(Rt.l,Ne.l,e);return this.setHSL(n,i,s),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,i=this.b,s=t.elements;return this.r=s[0]*e+s[3]*n+s[6]*i,this.g=s[1]*e+s[4]*n+s[7]*i,this.b=s[2]*e+s[5]*n+s[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Z=new z;z.NAMES=bs;var V=class{constructor(t=new E(1/0,1/0,1/0),e=new E(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(dt.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(dt.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=dt.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let s=n.getAttribute("position");if(e===!0&&s!==void 0&&t.isInstancedMesh!==!0&&t.isBatchedMesh!==!0)for(let r=0,a=s.count;r<a;r++)t.isMesh===!0?t.getVertexPosition(r,dt):dt.fromBufferAttribute(s,r),dt.applyMatrix4(t.matrixWorld),this.expandByPoint(dt);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Ue.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ue.copy(n.boundingBox)),Ue.applyMatrix4(t.matrixWorld),this.union(Ue)}let i=t.children;for(let s=0,r=i.length;s<r;s++)this.expandByObject(i[s],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,dt),dt.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ge),Fe.subVectors(this.max,ge),Jt.subVectors(t.a,ge),$t.subVectors(t.b,ge),Kt.subVectors(t.c,ge),Ct.subVectors($t,Jt),Pt.subVectors(Kt,$t),Vt.subVectors(Jt,Kt);let e=[0,-Ct.z,Ct.y,0,-Pt.z,Pt.y,0,-Vt.z,Vt.y,Ct.z,0,-Ct.x,Pt.z,0,-Pt.x,Vt.z,0,-Vt.x,-Ct.y,Ct.x,0,-Pt.y,Pt.x,0,-Vt.y,Vt.x,0];return!Bn(e,Jt,$t,Kt,Fe)||(e=[1,0,0,0,1,0,0,0,1],!Bn(e,Jt,$t,Kt,Fe))?!1:(Oe.crossVectors(Ct,Pt),e=[Oe.x,Oe.y,Oe.z],Bn(e,Jt,$t,Kt,Fe))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,dt).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(dt).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(_t[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),_t[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),_t[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),_t[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),_t[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),_t[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),_t[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),_t[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(_t),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},_t=[new E,new E,new E,new E,new E,new E,new E,new E],dt=new E,Ue=new V,Jt=new E,$t=new E,Kt=new E,Ct=new E,Pt=new E,Vt=new E,ge=new E,Fe=new E,Oe=new E,Gt=new E;function Bn(h,t,e,n,i){for(let s=0,r=h.length-3;s<=r;s+=3){Gt.fromArray(h,s);let a=i.x*Math.abs(Gt.x)+i.y*Math.abs(Gt.y)+i.z*Math.abs(Gt.z),l=t.dot(Gt),o=e.dot(Gt),c=n.dot(Gt);if(Math.max(-Math.max(l,o,c),Math.min(l,o,c))>a)return!1}return!0}var k=new E,Be=new q,cr=0,ct=class extends It{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:cr++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Ss,this.updateRanges=[],this.gpuType=xs,this.version=0,this._normalizationScale=t!==void 0?Si(t):void 0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this._normalizationScale=t._normalizationScale,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Be.fromBufferAttribute(this,e),Be.applyMatrix3(t),this.setXY(e,Be.x,Be.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)k.fromBufferAttribute(this,e),k.applyMatrix3(t),this.setXYZ(e,k.x,k.y,k.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)k.fromBufferAttribute(this,e),k.applyMatrix4(t),this.setXYZ(e,k.x,k.y,k.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)k.fromBufferAttribute(this,e),k.applyNormalMatrix(t),this.setXYZ(e,k.x,k.y,k.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)k.fromBufferAttribute(this,e),k.transformDirection(t),this.setXYZ(e,k.x,k.y,k.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=this._denormalize(n)),n}setComponent(t,e,n){return this.normalized&&(n=this._normalize(n)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=this._denormalize(e)),e}setX(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=this._denormalize(e)),e}setY(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=this._denormalize(e)),e}setZ(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=this._denormalize(e)),e}setW(t,e){return this.normalized&&(e=this._normalize(e)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),i=this._normalize(i)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t*=this.itemSize,this.normalized&&(e=this._normalize(e),n=this._normalize(n),i=this._normalize(i),s=this._normalize(s)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=s,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}_denormalize(t){let e=this._normalizationScale;return e!==void 0?Math.max(t/e,-1):Qs(t,this.array)}_normalize(t){let e=this._normalizationScale;return e!==void 0?Math.round(t*e):js(t,this.array)}};var tn=class extends ct{constructor(t,e,n){super(new Uint16Array(t),e,n)}},be=class extends ct{constructor(t,e,n){super(new Int32Array(t),e,n)}},en=class extends ct{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var Mt=class extends ct{constructor(t,e,n){super(new Float32Array(t),e,n)}},hr=new V,_e=new E,zn=new E,Ae=class{constructor(t=new E,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):hr.setFromPoints(t).getCenter(n);let i=0;for(let s=0,r=t.length;s<r;s++)i=Math.max(i,n.distanceToSquared(t[s]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;_e.subVectors(t,this.center);let e=_e.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(_e,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(zn.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(_e.copy(t.center).add(zn)),this.expandByPoint(_e.copy(t.center).sub(zn))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},ur=0,ot=new K,Vn=new Lt,Qt=new E,et=new V,xe=new V,X=new E,ne=class h extends It{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ur++}),this.uuid=Re(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Ys(t)?en:tn)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new N().getNormalMatrix(t);n.applyNormalMatrix(s),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return ot.makeRotationFromQuaternion(t),this.applyMatrix4(ot),this}rotateX(t){return ot.makeRotationX(t),this.applyMatrix4(ot),this}rotateY(t){return ot.makeRotationY(t),this.applyMatrix4(ot),this}rotateZ(t){return ot.makeRotationZ(t),this.applyMatrix4(ot),this}translate(t,e,n){return ot.makeTranslation(t,e,n),this.applyMatrix4(ot),this}scale(t,e,n){return ot.makeScale(t,e,n),this.applyMatrix4(ot),this}lookAt(t){return Vn.lookAt(t),Vn.updateMatrix(),this.applyMatrix4(Vn.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Qt).negate(),this.translate(Qt.x,Qt.y,Qt.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let i=0,s=t.length;i<s;i++){let r=t[i];n.push(r.x,r.y,r.z||0)}this.setAttribute("position",new Mt(n,3))}else{let n=Math.min(t.length,e.count);for(let i=0;i<n;i++){let s=t[i];e.setXYZ(i,s.x,s.y,s.z||0)}t.length>e.count&&G("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new V);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){B("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new E(-1/0,-1/0,-1/0),new E(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){let s=e[n];et.setFromBufferAttribute(s),this.morphTargetsRelative?(X.addVectors(this.boundingBox.min,et.min),this.boundingBox.expandByPoint(X),X.addVectors(this.boundingBox.max,et.max),this.boundingBox.expandByPoint(X)):(this.boundingBox.expandByPoint(et.min),this.boundingBox.expandByPoint(et.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&B('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ae);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){B("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new E,1/0);return}if(t){let n=this.boundingSphere.center;if(et.setFromBufferAttribute(t),e)for(let s=0,r=e.length;s<r;s++){let a=e[s];xe.setFromBufferAttribute(a),this.morphTargetsRelative?(X.addVectors(et.min,xe.min),et.expandByPoint(X),X.addVectors(et.max,xe.max),et.expandByPoint(X)):(et.expandByPoint(xe.min),et.expandByPoint(xe.max))}et.getCenter(n);let i=0;for(let s=0,r=t.count;s<r;s++)X.fromBufferAttribute(t,s),i=Math.max(i,n.distanceToSquared(X));if(e)for(let s=0,r=e.length;s<r;s++){let a=e[s],l=this.morphTargetsRelative;for(let o=0,c=a.count;o<c;o++)X.fromBufferAttribute(a,o),l&&(Qt.fromBufferAttribute(t,o),X.add(Qt)),i=Math.max(i,n.distanceToSquared(X))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&B('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){B("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,i=e.normal,s=e.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==n.count)&&(r=new ct(new Float32Array(4*n.count),4),this.setAttribute("tangent",r));let a=[],l=[],o=new Uint8Array(n.count);for(let M=0;M<n.count;M++)a[M]=new E,l[M]=new E;let c=new E,u=new E,p=new E,d=new q,f=new q,m=new q,_=new E,g=new E;function y(M,C,P){o[M]=o[C]=o[P]=1,c.fromBufferAttribute(n,M),u.fromBufferAttribute(n,C),p.fromBufferAttribute(n,P),d.fromBufferAttribute(s,M),f.fromBufferAttribute(s,C),m.fromBufferAttribute(s,P),u.sub(c),p.sub(c),f.sub(d),m.sub(d);let T=1/(f.x*m.y-m.x*f.y);isFinite(T)&&(_.copy(u).multiplyScalar(m.y).addScaledVector(p,-f.y).multiplyScalar(T),g.copy(p).multiplyScalar(f.x).addScaledVector(u,-m.x).multiplyScalar(T),a[M].add(_),a[C].add(_),a[P].add(_),l[M].add(g),l[C].add(g),l[P].add(g))}let x=this.groups;x.length===0&&(x=[{start:0,count:t.count}]);for(let M=0,C=x.length;M<C;++M){let P=x[M],T=P.start,L=P.count;for(let D=T,I=T+L;D<I;D+=3)y(t.getX(D+0),t.getX(D+1),t.getX(D+2))}let v=new E,S=new E,A=new E,b=new E;function w(M){A.fromBufferAttribute(i,M),b.copy(A);let C=a[M];v.copy(C),v.sub(A.multiplyScalar(A.dot(C))).normalize(),S.crossVectors(b,C);let T=S.dot(l[M])<0?-1:1;r.setXYZW(M,v.x,v.y,v.z,T)}for(let M=0,C=n.count;M<C;++M)o[M]&&w(M);this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new ct(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let p=0,d=n.count;p<d;p++)n.setXYZ(p,0,0,0);let i=new E,s=new E,r=new E,a=new E,l=new E,o=new E,c=new E,u=new E;if(t)for(let p=0,d=t.count;p<d;p+=3){let f=t.getX(p+0),m=t.getX(p+1),_=t.getX(p+2);i.fromBufferAttribute(e,f),s.fromBufferAttribute(e,m),r.fromBufferAttribute(e,_),c.subVectors(r,s),u.subVectors(i,s),c.cross(u),a.fromBufferAttribute(n,f),l.fromBufferAttribute(n,m),o.fromBufferAttribute(n,_),a.add(c),l.add(c),o.add(c),n.setXYZ(f,a.x,a.y,a.z),n.setXYZ(m,l.x,l.y,l.z),n.setXYZ(_,o.x,o.y,o.z)}else for(let p=0,d=e.count;p<d;p+=3)i.fromBufferAttribute(e,p+0),s.fromBufferAttribute(e,p+1),r.fromBufferAttribute(e,p+2),c.subVectors(r,s),u.subVectors(i,s),c.cross(u),n.setXYZ(p+0,c.x,c.y,c.z),n.setXYZ(p+1,c.x,c.y,c.z),n.setXYZ(p+2,c.x,c.y,c.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)X.fromBufferAttribute(t,e),X.normalize(),t.setXYZ(e,X.x,X.y,X.z)}toNonIndexed(){function t(a,l){let o=a.array,c=a.itemSize,u=a.normalized,p=new o.constructor(l.length*c),d=0,f=0;for(let m=0,_=l.length;m<_;m++){a.isInterleavedBufferAttribute?d=l[m]*a.data.stride+a.offset:d=l[m]*c;for(let g=0;g<c;g++)p[f++]=o[d++]}return new ct(p,c,u)}if(this.index===null)return G("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new h,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],o=t(l,n);e.setAttribute(a,o)}let s=this.morphAttributes;for(let a in s){let l=[],o=s[a];for(let c=0,u=o.length;c<u;c++){let p=o[c],d=t(p,n);l.push(d)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let a=0,l=r.length;a<l;a++){let o=r[a];e.addGroup(o.start,o.count,o.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let o in l)l[o]!==void 0&&(t[o]=l[o]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let o=n[l];t.data.attributes[l]=o.toJSON(t.data)}let i={},s=!1;for(let l in this.morphAttributes){let o=this.morphAttributes[l],c=[];for(let u=0,p=o.length;u<p;u++){let d=o[u];c.push(d.toJSON(t.data))}c.length>0&&(i[l]=c,s=!0)}s&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(t.data.groups=JSON.parse(JSON.stringify(r)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let i=t.attributes;for(let o in i){let c=i[o];this.setAttribute(o,c.clone(e))}let s=t.morphAttributes;for(let o in s){let c=[],u=s[o];for(let p=0,d=u.length;p<d;p++)c.push(u[p].clone(e));this.morphAttributes[o]=c}this.morphTargetsRelative=t.morphTargetsRelative;let r=t.groups;for(let o=0,c=r.length;o<c;o++){let u=r[o];this.addGroup(u.start,u.count,u.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Gn=new E,fr=new E,dr=new N,nn=class{constructor(t=new E(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let i=Gn.subVectors(n,e).cross(fr.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let i=t.delta(Gn),s=this.normal.dot(i);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/s;return n===!0&&(r<0||r>1)?null:e.copy(t.start).addScaledVector(i,r)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||dr.getNormalMatrix(t),i=this.coplanarPoint(Gn).applyMatrix4(t),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},pr=0,sn=class extends It{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:pr++}),this.uuid=Re(),this.name="",this.type="Material",this.blending=os,this.side=as,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=cs,this.blendDst=hs,this.blendEquation=ls,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new z(0,0,0),this.blendAlpha=0,this.depthFunc=Ze,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=vs,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=qe,this.stencilZFail=qe,this.stencilZPass=qe,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){G(\`Material: parameter '\${e}' has value of undefined.\`);continue}let i=this[e];if(i===void 0){G(\`Material: '\${e}' is not a property of THREE.\${this.type}.\`);continue}i&&i.isColor?i.set(n):i&&i.isVector2&&n&&n.isVector2||i&&i.isEuler&&n&&n.isEuler||i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(n.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(n.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(t).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(n.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(n.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(s=>s.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){let r=[];for(let a in s){let l=s[a];delete l.metadata,r.push(l)}return r}if(e){let s=i(t.textures),r=i(t.images);s.length>0&&(n.textures=s),r.length>0&&(n.images=r)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new z().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.diffuseRoughness!==void 0&&(this.diffuseRoughness=t.diffuseRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessMinimum),t.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=t.iridescenceThicknessMaximum),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=t.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=t.iridescenceThicknessRange[1]),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(n=>new nn().fromJSON(n))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new q().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new q().fromArray(t.clearcoatNormalScale)),t.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=e[t.diffuseRoughnessMap]||null),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let i=e.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=e[s].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var xt=new E,kn=new E,ze=new E,Ve=new E,ie=class{constructor(t=new E,e=new E(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,xt)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=xt.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(xt.copy(this.origin).addScaledVector(this.direction,e),xt.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){kn.copy(t).add(e).multiplyScalar(.5),ze.copy(e).sub(t).normalize(),Ve.copy(this.origin).sub(kn);let s=t.distanceTo(e)*.5,r=-this.direction.dot(ze),a=Ve.dot(this.direction),l=-Ve.dot(ze),o=Ve.lengthSq(),c=Math.abs(1-r*r),u,p,d,f;if(c>0)if(u=r*l-a,p=r*a-l,f=s*c,u>=0)if(p>=-f)if(p<=f){let m=1/c;u*=m,p*=m,d=u*(u+r*p+2*a)+p*(r*u+p+2*l)+o}else p=s,u=Math.max(0,-(r*p+a)),d=-u*u+p*(p+2*l)+o;else p=-s,u=Math.max(0,-(r*p+a)),d=-u*u+p*(p+2*l)+o;else p<=-f?(u=Math.max(0,-(-r*s+a)),p=u>0?-s:Math.min(Math.max(-s,-l),s),d=-u*u+p*(p+2*l)+o):p<=f?(u=0,p=Math.min(Math.max(-s,-l),s),d=p*(p+2*l)+o):(u=Math.max(0,-(r*s+a)),p=u>0?s:Math.min(Math.max(-s,-l),s),d=-u*u+p*(p+2*l)+o);else p=r>0?-s:s,u=Math.max(0,-(r*p+a)),d=-u*u+p*(p+2*l)+o;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(kn).addScaledVector(ze,p),d}intersectSphere(t,e){if(t.radius<0)return null;xt.subVectors(t.center,this.origin);let n=xt.dot(this.direction),i=xt.dot(xt)-n*n,s=t.radius*t.radius;if(i>s)return null;let r=Math.sqrt(s-i),a=n-r,l=n+r;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,s,r,a,l,o=1/this.direction.x,c=1/this.direction.y,u=1/this.direction.z,p=this.origin;return o>=0?(n=(t.min.x-p.x)*o,i=(t.max.x-p.x)*o):(n=(t.max.x-p.x)*o,i=(t.min.x-p.x)*o),c>=0?(s=(t.min.y-p.y)*c,r=(t.max.y-p.y)*c):(s=(t.max.y-p.y)*c,r=(t.min.y-p.y)*c),n>r||s>i||((s>n||isNaN(n))&&(n=s),(r<i||isNaN(i))&&(i=r),u>=0?(a=(t.min.z-p.z)*u,l=(t.max.z-p.z)*u):(a=(t.max.z-p.z)*u,l=(t.min.z-p.z)*u),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,xt)!==null}intersectTriangle(t,e,n,i,s){let r=this.origin,a=this.direction,l=a.x,o=a.y,c=a.z,u=t.x-r.x,p=t.y-r.y,d=t.z-r.z,f=e.x-r.x,m=e.y-r.y,_=e.z-r.z,g=n.x-r.x,y=n.y-r.y,x=n.z-r.z,v=Math.abs(l),S=Math.abs(o),A=Math.abs(c),b,w,M,C,P,T,L,D,I,H,at,ut;if(v>=S&&v>=A?(M=l,T=u,I=f,ut=g,l>=0?(b=o,w=c,C=p,P=d,L=m,D=_,H=y,at=x):(b=c,w=o,C=d,P=p,L=_,D=m,H=x,at=y)):S>=A?(M=o,T=p,I=m,ut=y,o>=0?(b=c,w=l,C=d,P=u,L=_,D=f,H=x,at=g):(b=l,w=c,C=u,P=d,L=f,D=_,H=g,at=x)):(M=c,T=d,I=_,ut=x,c>=0?(b=l,w=o,C=u,P=p,L=f,D=m,H=g,at=y):(b=o,w=l,C=p,P=u,L=m,D=f,H=y,at=g)),M===0)return null;let Et=b/M,Tt=w/M,Wt=1/M,Ui=C-Et*T,Fi=P-Tt*T,Oi=L-Et*I,Bi=D-Tt*I,zi=H-Et*ut,Vi=at-Tt*ut,fe=zi*Bi-Vi*Oi,de=Ui*Vi-Fi*zi,pe=Oi*Fi-Bi*Ui;if(i){if(fe<0||de<0||pe<0)return null}else if((fe<0||de<0||pe<0)&&(fe>0||de>0||pe>0))return null;let Cn=fe+de+pe;if(Cn===0)return null;let Pn=Wt*(fe*T+de*I+pe*ut);return(Cn>0?Pn<0:Pn>0)?null:this.at(Pn/Cn,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}};var se=class extends sn{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new z(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},Qi=new K,oi=new ie,Ge=new Ae,ke=new E,Ee=class extends Lt{constructor(t=new ne,e=new se){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0?this.morphTargetInfluences=t.morphTargetInfluences.slice():this.morphTargetInfluences=void 0,t.morphTargetDictionary!==void 0?this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary):this.morphTargetDictionary=void 0,this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,i=this.matrixWorld,s=t.params.Points.threshold,r=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ge.copy(n.boundingSphere),Ge.applyMatrix4(i),Ge.radius+=s,t.ray.intersectsSphere(Ge)===!1)return;Qi.copy(i).invert(),oi.copy(t.ray).applyMatrix4(Qi);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,o=n.index,u=n.attributes.position;if(o!==null){let p=Math.max(0,r.start),d=Math.min(o.count,r.start+r.count);for(let f=p,m=d;f<m;f++){let _=o.getX(f);ke.fromBufferAttribute(u,_),ji(ke,_,l,i,t,e,this)}}else{let p=Math.max(0,r.start),d=Math.min(u.count,r.start+r.count);for(let f=p,m=d;f<m;f++)ke.fromBufferAttribute(u,f),ji(ke,f,l,i,t,e,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}};function ji(h,t,e,n,i,s,r){let a=oi.distanceSqToPoint(h);if(a<e){let l=new E;oi.closestPointToPoint(h,l),l.applyMatrix4(n);let o=i.ray.origin.distanceTo(l);if(o<i.near||o>i.far)return;s.push({distance:o,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:r})}}function As(h){let t={};for(let e in h){t[e]={};for(let n in h[e]){let i=h[e][n];if(ts(i))i.isRenderTargetTexture?(G("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone();else if(Array.isArray(i))if(ts(i[0])){let s=[];for(let r=0,a=i.length;r<a;r++)s[r]=i[r].clone();t[e][n]=s}else t[e][n]=i.slice();else t[e][n]=i}}return t}function Q(h){let t={};for(let e=0;e<h.length;e++){let n=As(h[e]);for(let i in n)t[i]=n[i]}return t}function ts(h){return h&&(h.isColor||h.isMatrix3||h.isMatrix4||h.isVector2||h.isVector3||h.isVector4||h.isTexture||h.isQuaternion)}function jt(h,t){return!h||h.constructor===t?h:typeof t.BYTES_PER_ELEMENT=="number"?new t(h):Array.prototype.slice.call(h)}function He(h){return h!==void 0&&h.inTangents!==void 0&&h.outTangents!==void 0}var Dt=class{constructor(t,e,n,i){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,i=e[n],s=e[n-1];n:{t:{let r;e:{i:if(!(t<i)){for(let a=n+2;;){if(i===void 0){if(t<s)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(s=i,i=e[++n],t<i)break t}r=e.length;break e}if(!(t>=s)){let a=e[1];t<a&&(n=2,s=a);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=s,s=e[--n-1],t>=s)break t}r=n,n=0;break e}break n}for(;n<r;){let a=n+r>>>1;t<e[a]?r=a:n=a+1}if(i=e[n],s=e[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,t,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=t*i;for(let r=0;r!==i;++r)e[r]=n[s+r];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},rn=class extends Dt{constructor(t,e,n,i){super(t,e,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:jn,endingEnd:jn}}intervalChanged_(t,e,n){let i=this.parameterPositions,s=t-2,r=t+1,a=i[s],l=i[r];if(a===void 0)switch(this.getSettings_().endingStart){case ti:s=t,a=2*e-n;break;case ei:s=i.length-2,a=e+i[s]-i[s+1];break;default:s=t,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case ti:r=t,l=2*n-e;break;case ei:r=1,l=n+i[1]-i[0];break;default:r=t-1,l=e}let o=(n-e)*.5,c=this.valueSize;this._weightPrev=o/(e-a),this._weightNext=o/(l-n),this._offsetPrev=s*c,this._offsetNext=r*c}interpolate_(t,e,n,i){let s=this.resultBuffer,r=this.sampleValues,a=this.valueSize,l=t*a,o=l-a,c=this._offsetPrev,u=this._offsetNext,p=this._weightPrev,d=this._weightNext,f=(n-e)/(i-e),m=f*f,_=m*f,g=-p*_+2*p*m-p*f,y=(1+p)*_+(-1.5-2*p)*m+(-.5+p)*f+1,x=(-1-d)*_+(1.5+d)*m+.5*f,v=d*_-d*m;for(let S=0;S!==a;++S)s[S]=g*r[c+S]+y*r[o+S]+x*r[l+S]+v*r[u+S];return s}},an=class extends Dt{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){let s=this.resultBuffer,r=this.sampleValues,a=this.valueSize,l=t*a,o=l-a,c=(n-e)/(i-e),u=1-c;for(let p=0;p!==a;++p)s[p]=r[o+p]*u+r[l+p]*c;return s}},on=class extends Dt{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t){return this.copySampleValue_(t-1)}},ln=class extends Dt{interpolate_(t,e,n,i){let s=this.resultBuffer,r=this.sampleValues,a=this.valueSize,l=t*a,o=l-a,c=this.inTangents,u=this.outTangents;if(!c||!u){let f=(n-e)/(i-e),m=1-f;for(let _=0;_!==a;++_)s[_]=r[o+_]*m+r[l+_]*f;return s}let p=a*2,d=t-1;for(let f=0;f!==a;++f){let m=r[o+f],_=r[l+f],g=d*p+f*2,y=u[g],x=u[g+1],v=t*p+f*2,S=c[v],A=c[v+1],b=gr(n,e,y,S,i);s[f]=Es(b,m,x,A,_)}return s}};function Es(h,t,e,n,i){let s=1-h;return s*s*s*t+3*s*s*h*e+3*s*h*h*n+h*h*h*i}function mr(h,t,e,n,i){let s=1-h;return 3*s*s*(e-t)+6*s*h*(n-e)+3*h*h*(i-n)}function gr(h,t,e,n,i){let s=(h-t)/(i-t);for(let r=0;r<8;r++){let a=Es(s,t,e,n,i)-h;if(Math.abs(a)<1e-10)break;let l=mr(s,t,e,n,i);if(Math.abs(l)<1e-10)break;s=Math.max(0,Math.min(1,s-a/l))}return s}var nt=class{constructor(t,e,n,i){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=jt(e,this.TimeBufferType),this.values=jt(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:jt(t.times,Array),values:jt(t.values,Array)};let i=t.getInterpolation();i!==t.DefaultInterpolation&&(n.interpolation=i),He(t.settings)&&(n.settings={inTangents:jt(t.settings.inTangents,Array),outTangents:jt(t.settings.outTangents,Array)})}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new on(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new an(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new rn(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new ln(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case Se:e=this.InterpolantFactoryMethodDiscrete;break;case Je:e=this.InterpolantFactoryMethodLinear;break;case We:e=this.InterpolantFactoryMethodSmooth;break;case Qn:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return G("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Se;case this.InterpolantFactoryMethodLinear:return Je;case this.InterpolantFactoryMethodSmooth:return We;case this.InterpolantFactoryMethodBezier:return Qn}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]+=t;He(this.settings)&&(es(this.settings.inTangents,t),es(this.settings.outTangents,t))}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]*=t;He(this.settings)&&(ns(this.settings.inTangents,t),ns(this.settings.outTangents,t))}return this}trim(t,e){let n=this.times,i=n.length,s=0,r=i-1;for(;s!==i&&n[s]<t;)++s;for(;r!==-1&&n[r]>e;)--r;if(++r,s!==0||r!==i){s>=r&&(r=Math.max(r,1),s=r-1);let a=this.getValueSize();this.times=n.slice(s,r),this.values=this.values.slice(s*a,r*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(B("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,i=this.values,s=n.length;s===0&&(B("KeyframeTrack: Track is empty.",this),t=!1);let r=null;for(let a=0;a!==s;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){B("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(r!==null&&r>l){B("KeyframeTrack: Out of order keys.",this,a,l,r),t=!1;break}r=l}if(i!==void 0&&Zs(i))for(let a=0,l=i.length;a!==l;++a){let o=i[a];if(isNaN(o)){B("KeyframeTrack: Value is not a valid number.",this,a,o),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===We,s=t.length-1,r=1;for(let a=1;a<s;++a){let l=!1,o=t[a],c=t[a+1];if(o!==c&&(a!==1||o!==t[0]))if(i)l=!0;else{let u=a*n,p=u-n,d=u+n;for(let f=0;f!==n;++f){let m=e[u+f];if(m!==e[p+f]||m!==e[d+f]){l=!0;break}}}if(l){if(a!==r){t[r]=t[a];let u=a*n,p=r*n;for(let d=0;d!==n;++d)e[p+d]=e[u+d]}++r}}if(s>0){t[r]=t[s];for(let a=s*n,l=r*n,o=0;o!==n;++o)e[l+o]=e[a+o];++r}return r!==t.length?(this.times=t.slice(0,r),this.values=e.slice(0,r*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,i=new n(this.name,t,e);return i.createInterpolant=this.createInterpolant,He(this.settings)&&(i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),i}};function es(h,t){for(let e=0,n=h.length;e!==n;e+=2)h[e]+=t}function ns(h,t){for(let e=0,n=h.length;e!==n;e+=2)h[e]*=t}nt.prototype.ValueTypeName="";nt.prototype.TimeBufferType=Float32Array;nt.prototype.ValueBufferType=Float32Array;nt.prototype.DefaultInterpolation=Je;var Nt=class extends nt{constructor(t,e,n){super(t,e,n)}};Nt.prototype.ValueTypeName="bool";Nt.prototype.ValueBufferType=Array;Nt.prototype.DefaultInterpolation=Se;Nt.prototype.InterpolantFactoryMethodLinear=void 0;Nt.prototype.InterpolantFactoryMethodSmooth=void 0;var cn=class extends nt{constructor(t,e,n,i){super(t,e,n,i)}};cn.prototype.ValueTypeName="color";var hn=class extends nt{constructor(t,e,n,i){super(t,e,n,i)}};hn.prototype.ValueTypeName="number";var un=class extends Dt{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){let s=this.resultBuffer,r=this.sampleValues,a=this.valueSize,l=(n-e)/(i-e),o=t*a;for(let c=o+a;o!==c;o+=4)St.slerpFlat(s,0,r,o-a,r,o,l);return s}},Te=class extends nt{constructor(t,e,n,i){super(t,e,n,i)}InterpolantFactoryMethodLinear(t){return new un(this.times,this.values,this.getValueSize(),t)}};Te.prototype.ValueTypeName="quaternion";Te.prototype.InterpolantFactoryMethodSmooth=void 0;var Ut=class extends nt{constructor(t,e,n){super(t,e,n)}};Ut.prototype.ValueTypeName="string";Ut.prototype.ValueBufferType=Array;Ut.prototype.DefaultInterpolation=Se;Ut.prototype.InterpolantFactoryMethodLinear=void 0;Ut.prototype.InterpolantFactoryMethodSmooth=void 0;var fn=class extends nt{constructor(t,e,n,i){super(t,e,n,i)}};fn.prototype.ValueTypeName="vector";var li={enabled:!1,files:{},add:function(h,t){this.enabled!==!1&&(is(h)||(this.files[h]=t))},get:function(h){if(this.enabled!==!1&&!is(h))return this.files[h]},remove:function(h){delete this.files[h]},clear:function(){this.files={}}};function is(h){try{let t=h.slice(h.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch{return!1}}var dn=class{constructor(t,e,n){let i=this,s=!1,r=0,a=0,l,o=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(c){a++,s===!1&&i.onStart!==void 0&&i.onStart(c,r,a),s=!0},this.itemEnd=function(c){r++,i.onProgress!==void 0&&i.onProgress(c,r,a),r===a&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(c){i.onError!==void 0&&i.onError(c)},this.resolveURL=function(c){return c=c.normalize("NFC"),l?l(c):c},this.setURLModifier=function(c){return l=c,this},this.addHandler=function(c,u){return o.push(c,u),this},this.removeHandler=function(c){let u=o.indexOf(c);return u!==-1&&o.splice(u,2),this},this.getHandler=function(c){for(let u=0,p=o.length;u<p;u+=2){let d=o[u],f=o[u+1];if(d.global&&(d.lastIndex=0),d.test(c))return f}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Ts=new dn,kt=class{constructor(t){this.manager=t!==void 0?t:Ts,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},this.priority="auto",this.cache="default",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(i,s){n.load(t,i,e,s)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}setPriority(t){return this.priority=t,this}setCache(t){return this.cache=t,this}abort(){return this}};kt.DEFAULT_MATERIAL_NAME="__DEFAULT";var yt={},ci=class extends Error{constructor(t,e){super(t),this.response=e}},we=class extends kt{constructor(t){super(t),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(t,e,n,i){t===void 0&&(t=""),this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);let s=li.get(\`file:\${t}\`);if(s!==void 0){this.manager.itemStart(t),setTimeout(()=>{e&&e(s),this.manager.itemEnd(t)},0);return}if(yt[t]!==void 0){yt[t].push({onLoad:e,onProgress:n,onError:i});return}yt[t]=[],yt[t].push({onLoad:e,onProgress:n,onError:i});let r=new Request(t,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",priority:this.priority,cache:this.cache,signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(r).then(o=>{if(o.status===200||o.status===0){if(o.status===0&&G("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||o.body===void 0||o.body.getReader===void 0)return o;let c=yt[t],u=o.body.getReader(),p=o.headers.get("X-File-Size")||o.headers.get("Content-Length"),d=p?parseInt(p):0,f=d!==0,m=0,_=new ReadableStream({start(g){y();function y(){u.read().then(({done:x,value:v})=>{if(x)g.close();else{m+=v.byteLength;let S=new ProgressEvent("progress",{lengthComputable:f,loaded:m,total:d});for(let A=0,b=c.length;A<b;A++){let w=c[A];w.onProgress&&w.onProgress(S)}g.enqueue(v),y()}},x=>{g.error(x)})}}});return new Response(_)}else throw new ci(\`fetch for "\${o.url}" responded with \${o.status}: \${o.statusText}\`,o)}).then(o=>{switch(l){case"arraybuffer":return o.arrayBuffer();case"blob":return o.blob();case"document":return o.text().then(c=>new DOMParser().parseFromString(c,a));case"json":return o.json();default:if(a==="")return o.text();{let u=/charset="?([^;"\\s]*)"?/i.exec(a),p=u&&u[1]?u[1].toLowerCase():void 0,d=new TextDecoder(p);return o.arrayBuffer().then(f=>d.decode(f))}}}).then(o=>{li.add(\`file:\${t}\`,o);let c=yt[t];delete yt[t];for(let u=0,p=c.length;u<p;u++){let d=c[u];d.onLoad&&d.onLoad(o)}}).catch(o=>{let c=yt[t];if(c===void 0)throw this.manager.itemError(t),o;delete yt[t];for(let u=0,p=c.length;u<p;u++){let d=c[u];d.onError&&d.onError(o)}this.manager.itemError(t)}).finally(()=>{this.manager.itemEnd(t)}),this.manager.itemStart(t)}setResponseType(t){return this.responseType=t,this}setMimeType(t){return this.mimeType=t,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Mi="\\\\[\\\\]\\\\.:\\\\/",_r=new RegExp("["+Mi+"]","g"),bi="[^"+Mi+"]",xr="[^"+Mi.replace("\\\\.","")+"]",yr=/((?:WC+[\\/:])*)/.source.replace("WC",bi),vr=/(WCOD+)?/.source.replace("WCOD",xr),Sr=/(?:\\.(WC+)(?:\\[(.+)\\])?)?/.source.replace("WC",bi),Mr=/\\.(WC+)(?:\\[(.+)\\])?/.source.replace("WC",bi),br=new RegExp("^"+yr+vr+Sr+Mr+"$"),Ar=["material","materials","bones","map"],hi=class{constructor(t,e,n){let i=n||O.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,i)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},O=class h{constructor(t,e,n){this.path=e,this.parsedPath=n||h.parseTrackName(e),this.node=h.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new h.Composite(t,e,n):new h(t,e,n)}static sanitizeNodeName(t){return t.replace(/\\s/g,"_").replace(_r,"")}static parseTrackName(t){let e=br.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let s=n.nodeName.substring(i+1);Ar.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(s){for(let r=0;r<s.length;r++){let a=s[r];if(a.name===e||a.uuid===e)return a;let l=n(a.children);if(l)return l}return null},i=n(t.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)t[e++]=n[i]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,i=e.propertyName,s=e.propertyIndex;if(t||(t=h.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){G("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let o=e.objectIndex;switch(n){case"materials":if(!t.material){B("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){B("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){B("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let c=0;c<t.length;c++)if(t[c].name===o){o=c;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){B("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){B("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){B("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(o!==void 0){if(t[o]===void 0){B("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[o]}}let r=t[i];if(r===void 0){let o=e.nodeName;B("PropertyBinding: Trying to update property for track: "+o+"."+i+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!t.geometry){B("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){B("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[s]!==void 0&&(s=t.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=s}else r.fromArray!==void 0&&r.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(l=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};O.Composite=hi;O.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};O.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};O.prototype.GetterByBindingType=[O.prototype._getValue_direct,O.prototype._getValue_array,O.prototype._getValue_arrayElement,O.prototype._getValue_toArray];O.prototype.SetterByBindingTypeAndVersioning=[[O.prototype._setValue_direct,O.prototype._setValue_direct_setNeedsUpdate,O.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[O.prototype._setValue_array,O.prototype._setValue_array_setNeedsUpdate,O.prototype._setValue_array_setMatrixWorldNeedsUpdate],[O.prototype._setValue_arrayElement,O.prototype._setValue_arrayElement_setNeedsUpdate,O.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[O.prototype._setValue_fromArray,O.prototype._setValue_fromArray_setNeedsUpdate,O.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Rl=new Float32Array(1);var ui=class{static{this.prototype.isMatrix2=!0}constructor(t,e,n,i){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,i){let s=this.elements;return s[0]=t,s[2]=e,s[1]=n,s[3]=i,this}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"187"}}));typeof window<"u"&&(window.__THREE__?G("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="187");var Er=\`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif\`,Tr=\`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif\`,wr=\`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif\`,Rr=\`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif\`,Cr=\`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif\`,Pr=\`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif\`,Ir=\`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif\`,Lr=\`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif\`,Dr=\`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif\`,Nr=\`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif\`,Ur=\`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif\`,Fr=\`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif\`,Or=\`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated\`,Br=\`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif\`,zr=\`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif\`,Vr=\`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif\`,Gr=\`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif\`,kr=\`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif\`,Hr=\`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif\`,Wr=\`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif\`,Xr=\`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif\`,qr=\`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif\`,Yr=\`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif\`,Zr=\`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated\`,Jr=\`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif\`,$r=\`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif\`,Kr=\`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif\`,Qr=\`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif\`,jr=\`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif\`,ta="gl_FragColor = linearToOutputTexel( gl_FragColor );",ea=\`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}\`,na=\`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif\`,ia=\`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif\`,sa=\`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif\`,ra=\`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif\`,aa=\`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif\`,oa=\`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif\`,la=\`#ifdef USE_FOG
	varying float vFogDepth;
#endif\`,ca=\`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif\`,ha=\`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif\`,ua=\`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}\`,fa=\`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif\`,da=\`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;\`,pa=\`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert\`,ma=\`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>\`,ga=\`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif\`,_a=\`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;\`,xa=\`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon\`,ya=\`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;\`,va=\`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong\`,Sa=\`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif\`,Ma=\`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}\`,ba=\`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif\`,Aa=\`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif\`,Ea=\`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif\`,Ta=\`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif\`,wa=\`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif\`,Ra=\`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif\`,Ca=\`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif\`,Pa=\`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif\`,Ia=\`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif\`,La=\`#ifdef USE_MAP
	uniform sampler2D map;
#endif\`,Da=\`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif\`,Na=\`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif\`,Ua=\`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif\`,Fa=\`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif\`,Oa=\`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif\`,Ba=\`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif\`,za=\`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif\`,Va=\`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif\`,Ga=\`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif\`,ka=\`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;\`,Ha=\`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif\`,Wa=\`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif\`,Xa=\`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif\`,qa=\`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif\`,Ya=\`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif\`,Za=\`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif\`,Ja=\`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif\`,$a=\`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif\`,Ka=\`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif\`,Qa=\`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );\`,ja=\`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}\`,to=\`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif\`,eo=\`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;\`,no=\`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif\`,io=\`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif\`,so=\`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif\`,ro=\`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif\`,ao=\`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif\`,oo=\`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif\`,lo=\`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif\`,co=\`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}\`,ho=\`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif\`,uo=\`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif\`,fo=\`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif\`,po=\`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif\`,mo=\`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif\`,go=\`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif\`,_o=\`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif\`,xo=\`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }\`,yo=\`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif\`,vo=\`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif\`,So=\`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif\`,Mo=\`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif\`,bo=\`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif\`,Ao=\`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif\`,Eo=\`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}\`,To=\`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}\`,wo=\`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}\`,Ro=\`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}\`,Co=\`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}\`,Po=\`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}\`,Io=\`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}\`,Lo=\`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}\`,Do=\`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}\`,No=\`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}\`,Uo=\`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}\`,Fo=\`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}\`,Oo=\`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}\`,Bo=\`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}\`,zo=\`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}\`,Vo=\`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,Go=\`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}\`,ko=\`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,Ho=\`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}\`,Wo=\`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,Xo=\`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}\`,qo=\`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}\`,Yo=\`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}\`,Zo=\`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,Jo=\`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}\`,$o=\`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,Ko=\`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}\`,Qo=\`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}\`,jo=\`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}\`,tl=\`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}\`,el=\`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}\`,nl=\`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}\`,il=\`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}\`,sl=\`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}\`,U={alphahash_fragment:Er,alphahash_pars_fragment:Tr,alphamap_fragment:wr,alphamap_pars_fragment:Rr,alphatest_fragment:Cr,alphatest_pars_fragment:Pr,aomap_fragment:Ir,aomap_pars_fragment:Lr,batching_pars_vertex:Dr,batching_vertex:Nr,begin_vertex:Ur,beginnormal_vertex:Fr,bsdfs:Or,iridescence_fragment:Br,bumpmap_pars_fragment:zr,clipping_planes_fragment:Vr,clipping_planes_pars_fragment:Gr,clipping_planes_pars_vertex:kr,clipping_planes_vertex:Hr,color_fragment:Wr,color_pars_fragment:Xr,color_pars_vertex:qr,color_vertex:Yr,common:Zr,defaultnormal_vertex:Jr,displacementmap_pars_vertex:$r,displacementmap_vertex:Kr,emissivemap_fragment:Qr,emissivemap_pars_fragment:jr,colorspace_fragment:ta,colorspace_pars_fragment:ea,envmap_fragment:na,envmap_common_pars_fragment:ia,envmap_pars_fragment:sa,envmap_pars_vertex:ra,envmap_physical_pars_fragment:ga,envmap_vertex:aa,fog_vertex:oa,fog_pars_vertex:la,fog_fragment:ca,fog_pars_fragment:ha,gradientmap_pars_fragment:ua,lightmap_pars_fragment:fa,lights_lambert_fragment:da,lights_lambert_pars_fragment:pa,lights_pars_begin:ma,lights_toon_fragment:_a,lights_toon_pars_fragment:xa,lights_phong_fragment:ya,lights_phong_pars_fragment:va,lights_physical_fragment:Sa,lights_physical_pars_fragment:Ma,lights_fragment_begin:ba,lights_fragment_maps:Aa,lights_fragment_end:Ea,lightprobes_pars_fragment:Ta,logdepthbuf_fragment:wa,logdepthbuf_pars_fragment:Ra,logdepthbuf_pars_vertex:Ca,logdepthbuf_vertex:Pa,map_fragment:Ia,map_pars_fragment:La,map_particle_fragment:Da,map_particle_pars_fragment:Na,metalnessmap_fragment:Ua,metalnessmap_pars_fragment:Fa,morphinstance_vertex:Oa,morphcolor_vertex:Ba,morphnormal_vertex:za,morphtarget_pars_vertex:Va,morphtarget_vertex:Ga,normal_fragment_begin:ka,normal_fragment_maps:Ha,normal_pars_fragment:Wa,normal_pars_vertex:Xa,normal_vertex:qa,normalmap_pars_fragment:Ya,clearcoat_normal_fragment_begin:Za,clearcoat_normal_fragment_maps:Ja,clearcoat_pars_fragment:$a,iridescence_pars_fragment:Ka,opaque_fragment:Qa,packing:ja,premultiplied_alpha_fragment:to,project_vertex:eo,dithering_fragment:no,dithering_pars_fragment:io,roughnessmap_fragment:so,roughnessmap_pars_fragment:ro,shadowmap_pars_fragment:ao,shadowmap_pars_vertex:oo,shadowmap_vertex:lo,shadowmask_pars_fragment:co,skinbase_vertex:ho,skinning_pars_vertex:uo,skinning_vertex:fo,skinnormal_vertex:po,specularmap_fragment:mo,specularmap_pars_fragment:go,tonemapping_fragment:_o,tonemapping_pars_fragment:xo,transmission_fragment:yo,transmission_pars_fragment:vo,uv_pars_fragment:So,uv_pars_vertex:Mo,uv_vertex:bo,worldpos_vertex:Ao,background_vert:Eo,background_frag:To,backgroundCube_vert:wo,backgroundCube_frag:Ro,cube_vert:Co,cube_frag:Po,depth_vert:Io,depth_frag:Lo,distance_vert:Do,distance_frag:No,equirect_vert:Uo,equirect_frag:Fo,linedashed_vert:Oo,linedashed_frag:Bo,meshbasic_vert:zo,meshbasic_frag:Vo,meshlambert_vert:Go,meshlambert_frag:ko,meshmatcap_vert:Ho,meshmatcap_frag:Wo,meshnormal_vert:Xo,meshnormal_frag:qo,meshphong_vert:Yo,meshphong_frag:Zo,meshphysical_vert:Jo,meshphysical_frag:$o,meshtoon_vert:Ko,meshtoon_frag:Qo,points_vert:jo,points_frag:tl,shadow_vert:el,shadow_frag:nl,sprite_vert:il,sprite_frag:sl},R={common:{diffuse:{value:new z(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new N},alphaMap:{value:null},alphaMapTransform:{value:new N},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new N}},envmap:{envMap:{value:null},envMapRotation:{value:new N},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new N}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new N}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new N},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new N},normalScale:{value:new q(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new N},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new N}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new N}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new N}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new z(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new z(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new N},alphaTest:{value:0},uvTransform:{value:new N}},sprite:{diffuse:{value:new z(16777215)},opacity:{value:1},center:{value:new q(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new N},alphaMap:{value:null},alphaMapTransform:{value:new N},alphaTest:{value:0}}},ws={basic:{uniforms:Q([R.common,R.specularmap,R.envmap,R.aomap,R.lightmap,R.fog]),vertexShader:U.meshbasic_vert,fragmentShader:U.meshbasic_frag},lambert:{uniforms:Q([R.common,R.specularmap,R.envmap,R.aomap,R.lightmap,R.emissivemap,R.bumpmap,R.normalmap,R.displacementmap,R.fog,R.lights,{emissive:{value:new z(0)},envMapIntensity:{value:1}}]),vertexShader:U.meshlambert_vert,fragmentShader:U.meshlambert_frag},phong:{uniforms:Q([R.common,R.specularmap,R.envmap,R.aomap,R.lightmap,R.emissivemap,R.bumpmap,R.normalmap,R.displacementmap,R.fog,R.lights,{emissive:{value:new z(0)},specular:{value:new z(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:U.meshphong_vert,fragmentShader:U.meshphong_frag},standard:{uniforms:Q([R.common,R.envmap,R.aomap,R.lightmap,R.emissivemap,R.bumpmap,R.normalmap,R.displacementmap,R.roughnessmap,R.metalnessmap,R.fog,R.lights,{emissive:{value:new z(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:U.meshphysical_vert,fragmentShader:U.meshphysical_frag},toon:{uniforms:Q([R.common,R.aomap,R.lightmap,R.emissivemap,R.bumpmap,R.normalmap,R.displacementmap,R.gradientmap,R.fog,R.lights,{emissive:{value:new z(0)}}]),vertexShader:U.meshtoon_vert,fragmentShader:U.meshtoon_frag},matcap:{uniforms:Q([R.common,R.bumpmap,R.normalmap,R.displacementmap,R.fog,{matcap:{value:null}}]),vertexShader:U.meshmatcap_vert,fragmentShader:U.meshmatcap_frag},points:{uniforms:Q([R.points,R.fog]),vertexShader:U.points_vert,fragmentShader:U.points_frag},dashed:{uniforms:Q([R.common,R.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:U.linedashed_vert,fragmentShader:U.linedashed_frag},depth:{uniforms:Q([R.common,R.displacementmap]),vertexShader:U.depth_vert,fragmentShader:U.depth_frag},normal:{uniforms:Q([R.common,R.bumpmap,R.normalmap,R.displacementmap,{opacity:{value:1}}]),vertexShader:U.meshnormal_vert,fragmentShader:U.meshnormal_frag},sprite:{uniforms:Q([R.sprite,R.fog]),vertexShader:U.sprite_vert,fragmentShader:U.sprite_frag},background:{uniforms:{uvTransform:{value:new N},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:U.background_vert,fragmentShader:U.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new N}},vertexShader:U.backgroundCube_vert,fragmentShader:U.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:U.cube_vert,fragmentShader:U.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:U.equirect_vert,fragmentShader:U.equirect_frag},distance:{uniforms:Q([R.common,R.displacementmap,{referencePosition:{value:new E},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:U.distance_vert,fragmentShader:U.distance_frag},shadow:{uniforms:Q([R.lights,R.fog,{color:{value:new z(0)},opacity:{value:1}}]),vertexShader:U.shadow_vert,fragmentShader:U.shadow_frag}};ws.physical={uniforms:Q([ws.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new N},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new N},clearcoatNormalScale:{value:new q(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new N},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new N},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new N},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new N},sheen:{value:0},sheenColor:{value:new z(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new N},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new N},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new N},transmissionSamplerSize:{value:new q},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new N},attenuationDistance:{value:0},attenuationColor:{value:new z(0)},specularColor:{value:new z(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new N},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new N},anisotropyVector:{value:new q},anisotropyMap:{value:null},anisotropyMapTransform:{value:new N}}]),vertexShader:U.meshphysical_vert,fragmentShader:U.meshphysical_frag};var rl=new N;rl.set(-1,0,0,0,1,0,0,0,1);var Xp={[fi]:"LINEAR_TONE_MAPPING",[di]:"REINHARD_TONE_MAPPING",[pi]:"CINEON_TONE_MAPPING",[mi]:"ACES_FILMIC_TONE_MAPPING",[_i]:"AGX_TONE_MAPPING",[xi]:"NEUTRAL_TONE_MAPPING",[gi]:"CUSTOM_TONE_MAPPING"};var qp=new Float32Array(16),Yp=new Float32Array(9),Zp=new Float32Array(4);var Jp={[fi]:"Linear",[di]:"Reinhard",[pi]:"Cineon",[mi]:"ACESFilmic",[_i]:"AgX",[xi]:"Neutral",[gi]:"Custom"};var $p={[ss]:"SHADOWMAP_TYPE_PCF",[rs]:"SHADOWMAP_TYPE_VSM"};var Kp={[ps]:"ENVMAP_MODE_REFRACTION"};var Qp={[us]:"ENVMAP_BLENDING_MULTIPLY",[fs]:"ENVMAP_BLENDING_MIX",[ds]:"ENVMAP_BLENDING_ADD"};var al=new N;al.set(-1,0,0,0,1,0,0,0,1);var jp=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);var pn=class extends kt{constructor(t){super(t),this.littleEndian=!0}load(t,e,n,i){let s=this,r=new we(s.manager);r.setPriority(s.priority),r.setCache(s.cache),r.setPath(s.path),r.setResponseType("arraybuffer"),r.setRequestHeader(s.requestHeader),r.setWithCredentials(s.withCredentials),r.load(t,function(a){try{e(s.parse(a))}catch(l){i?i(l):console.error(l),s.manager.itemError(t)}},n,i)}_getDataView(t,e,n,i){switch(n){case"F":return i===8?t.getFloat64(e,this.littleEndian):t.getFloat32(e,this.littleEndian);case"I":return i===1?t.getInt8(e):i===2?t.getInt16(e,this.littleEndian):t.getInt32(e,this.littleEndian);case"U":return i===1?t.getUint8(e):i===2?t.getUint16(e,this.littleEndian):t.getUint32(e,this.littleEndian)}}parse(t){function e(d,f){let m=d.length,_=new Uint8Array(f),g=0,y=0,x,v,S;do if(x=d[g++],x<32){if(x++,y+x>f)throw new Error("THREE.PCDLoader: Output buffer is not large enough");if(g+x>m)throw new Error("THREE.PCDLoader: Invalid compressed data");do _[y++]=d[g++];while(--x)}else{if(v=x>>5,S=y-((x&31)<<8)-1,g>=m)throw new Error("THREE.PCDLoader: Invalid compressed data");if(v===7&&(v+=d[g++],g>=m))throw new Error("THREE.PCDLoader: Invalid compressed data");if(S-=d[g++],y+v+2>f)throw new Error("THREE.PCDLoader: Output buffer is not large enough");if(S<0)throw new Error("THREE.PCDLoader: Invalid compressed data");if(S>=y)throw new Error("THREE.PCDLoader: Invalid compressed data");do _[y++]=_[S++];while(--v+2)}while(g<m);return _}function n(d){let f={},m=new Uint8Array(d),_="",g="",y=0,x=!1,v=m.length;for(;y<v&&x===!1;){let M=String.fromCharCode(m[y++]);M===\`
\`||M==="\\r"?(g.trim().toLowerCase().startsWith("data")&&(x=!0),g=""):g+=M,_+=M}let S=_.search(/[\\r\\n]DATA\\s(\\S*)\\s/i),A=/[\\r\\n]DATA\\s(\\S*)\\s/i.exec(_.slice(S-1));if(f.data=A[1],f.headerLen=A[0].length+S,f.str=_.slice(0,f.headerLen),f.str=f.str.replace(/^#.*/gm,""),f.version=/^VERSION (.*)/im.exec(f.str),f.fields=/^FIELDS (.*)/im.exec(f.str),f.size=/^SIZE (.*)/im.exec(f.str),f.type=/^TYPE (.*)/im.exec(f.str),f.count=/^COUNT (.*)/im.exec(f.str),f.width=/^WIDTH (.*)/im.exec(f.str),f.height=/^HEIGHT (.*)/im.exec(f.str),f.viewpoint=/^VIEWPOINT (.*)/im.exec(f.str),f.points=/^POINTS (.*)/im.exec(f.str),f.version!==null&&(f.version=parseFloat(f.version[1])),f.fields=f.fields!==null?f.fields[1].split(" "):[],f.type!==null&&(f.type=f.type[1].split(" ")),f.width!==null&&(f.width=parseInt(f.width[1])),f.height!==null&&(f.height=parseInt(f.height[1])),f.viewpoint!==null&&(f.viewpoint=f.viewpoint[1]),f.points!==null&&(f.points=parseInt(f.points[1],10)),f.points===null&&(f.points=f.width*f.height),f.size!==null&&(f.size=f.size[1].split(" ").map(function(M){return parseInt(M,10)})),f.count!==null)f.count=f.count[1].split(" ").map(function(M){return parseInt(M,10)});else{f.count=[];for(let M=0,C=f.fields.length;M<C;M++)f.count.push(1)}f.offset={};let b=0,w=0;for(let M=0,C=f.fields.length;M<C;M++)f.data==="ascii"?(f.offset[f.fields[M]]=w,w+=f.count[M]):(f.offset[f.fields[M]]=b,b+=f.size[M]*f.count[M]);return f.rowSize=b,f}let i=n(t),s=[],r=[],a=[],l=[],o=[],c=new z;if(i.data==="ascii"){let d=i.offset,_=new TextDecoder().decode(t).slice(i.headerLen).split(\`
\`);for(let g=0,y=_.length;g<y;g++){if(_[g]==="")continue;let x=_[g].trim().split(/\\s+/);if(d.x!==void 0&&(s.push(parseFloat(x[d.x])),s.push(parseFloat(x[d.y])),s.push(parseFloat(x[d.z]))),d.rgb!==void 0){let v=i.fields.findIndex(P=>P==="rgb"),S=i.type[v],A=parseFloat(x[d.rgb]),b=A;if(S==="F"){let P=new Float32Array(1);P[0]=A,b=new Int32Array(P.buffer)[0]}let w=(b>>16&255)/255,M=(b>>8&255)/255,C=(b>>0&255)/255;c.setRGB(w,M,C,J),a.push(c.r,c.g,c.b)}d.normal_x!==void 0&&(r.push(parseFloat(x[d.normal_x])),r.push(parseFloat(x[d.normal_y])),r.push(parseFloat(x[d.normal_z]))),d.intensity!==void 0&&l.push(parseFloat(x[d.intensity])),d.label!==void 0&&o.push(parseInt(x[d.label]))}}if(i.data==="binary_compressed"){let d=new Uint32Array(t.slice(i.headerLen,i.headerLen+8)),f=d[0],m=d[1],_=e(new Uint8Array(t,i.headerLen+8,f),m),g=new DataView(_.buffer),y=i.offset;for(let x=0;x<i.points;x++){if(y.x!==void 0){let v=i.fields.indexOf("x"),S=i.fields.indexOf("y"),A=i.fields.indexOf("z");s.push(this._getDataView(g,i.points*y.x+i.size[v]*x,i.type[v],i.size[v])),s.push(this._getDataView(g,i.points*y.y+i.size[S]*x,i.type[S],i.size[S])),s.push(this._getDataView(g,i.points*y.z+i.size[A]*x,i.type[A],i.size[A]))}if(y.rgb!==void 0){let v=i.fields.indexOf("rgb"),S=g.getUint8(i.points*y.rgb+i.size[v]*x+2)/255,A=g.getUint8(i.points*y.rgb+i.size[v]*x+1)/255,b=g.getUint8(i.points*y.rgb+i.size[v]*x+0)/255;c.setRGB(S,A,b,J),a.push(c.r,c.g,c.b)}if(y.normal_x!==void 0){let v=i.fields.indexOf("normal_x"),S=i.fields.indexOf("normal_y"),A=i.fields.indexOf("normal_z");r.push(this._getDataView(g,i.points*y.normal_x+i.size[v]*x,i.type[v],i.size[v])),r.push(this._getDataView(g,i.points*y.normal_y+i.size[S]*x,i.type[S],i.size[S])),r.push(this._getDataView(g,i.points*y.normal_z+i.size[A]*x,i.type[A],i.size[A]))}if(y.intensity!==void 0){let v=i.fields.indexOf("intensity");l.push(this._getDataView(g,i.points*y.intensity+i.size[v]*x,i.type[v],i.size[v]))}if(y.label!==void 0){let v=i.fields.indexOf("label");o.push(this._getDataView(g,i.points*y.label+i.size[v]*x,i.type[v],i.size[v]))}}}if(i.data==="binary"){let d=new DataView(t,i.headerLen),f=i.offset;for(let m=0,_=0;m<i.points;m++,_+=i.rowSize){if(f.x!==void 0){let g=i.fields.indexOf("x"),y=i.fields.indexOf("y"),x=i.fields.indexOf("z");s.push(this._getDataView(d,_+f.x,i.type[g],i.size[g])),s.push(this._getDataView(d,_+f.y,i.type[y],i.size[y])),s.push(this._getDataView(d,_+f.z,i.type[x],i.size[x]))}if(f.rgb!==void 0){let g=d.getUint8(_+f.rgb+2)/255,y=d.getUint8(_+f.rgb+1)/255,x=d.getUint8(_+f.rgb+0)/255;c.setRGB(g,y,x,J),a.push(c.r,c.g,c.b)}if(f.normal_x!==void 0){let g=i.fields.indexOf("normal_x"),y=i.fields.indexOf("normal_y"),x=i.fields.indexOf("normal_z");r.push(this._getDataView(d,_+f.normal_x,i.type[g],i.size[g])),r.push(this._getDataView(d,_+f.normal_y,i.type[y],i.size[y])),r.push(this._getDataView(d,_+f.normal_z,i.type[x],i.size[x]))}if(f.intensity!==void 0){let g=i.fields.indexOf("intensity");l.push(this._getDataView(d,_+f.intensity,i.type[g],i.size[g]))}if(f.label!==void 0){let g=i.fields.indexOf("label");o.push(this._getDataView(d,_+f.label,i.type[g],i.size[g]))}}}let u=new ne;s.length>0&&u.setAttribute("position",new Mt(s,3)),r.length>0&&u.setAttribute("normal",new Mt(r,3)),a.length>0&&u.setAttribute("color",new Mt(a,3)),l.length>0&&u.setAttribute("intensity",new Mt(l,1)),o.length>0&&u.setAttribute("label",new be(o,1)),u.computeBoundingSphere();let p=new se({size:.005});return a.length>0&&(p.vertexColors=!0),new Ee(u,p)}};var mn=Math.pow(2,-24),gn=Symbol("SKIP_GENERATION"),_n={strategy:0,maxDepth:40,targetLeafSize:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null,[gn]:!1};function W(h,t,e){return e.min.x=t[h],e.min.y=t[h+1],e.min.z=t[h+2],e.max.x=t[h+3],e.max.y=t[h+4],e.max.z=t[h+5],e}function Ce(h){let t=-1,e=-1/0;for(let n=0;n<3;n++){let i=h[n+3]-h[n];i>e&&(e=i,t=n)}return t}function Ai(h,t){t.set(h)}function Ei(h,t,e){let n,i;for(let s=0;s<3;s++){let r=s+3;n=h[s],i=t[s],e[s]=n<i?n:i,n=h[r],i=t[r],e[r]=n>i?n:i}}function Pe(h,t,e){for(let n=0;n<3;n++){let i=t[h+2*n],s=t[h+2*n+1],r=i-s,a=i+s;r<e[n]&&(e[n]=r),a>e[n+3]&&(e[n+3]=a)}}function re(h){let t=h[3]-h[0],e=h[4]-h[1],n=h[5]-h[2];return 2*(t*e+e*n+n*t)}function $(h,t){return t[h+15]===65535}function j(h,t){return t[h+6]}function ht(h,t){return t[h+14]}function st(h){return h+8}function rt(h,t){let e=t[h+6];return h+e*8}function Rs(h,t){return t[h+7]}function xn(h,t,e,n,i){let s=1/0,r=1/0,a=1/0,l=-1/0,o=-1/0,c=-1/0,u=1/0,p=1/0,d=1/0,f=-1/0,m=-1/0,_=-1/0,g=h.offset||0;for(let y=(t-g)*6,x=(t+e-g)*6;y<x;y+=6){let v=h[y+0],S=h[y+1],A=v-S,b=v+S;A<s&&(s=A),b>l&&(l=b),v<u&&(u=v),v>f&&(f=v);let w=h[y+2],M=h[y+3],C=w-M,P=w+M;C<r&&(r=C),P>o&&(o=P),w<p&&(p=w),w>m&&(m=w);let T=h[y+4],L=h[y+5],D=T-L,I=T+L;D<a&&(a=D),I>c&&(c=I),T<d&&(d=T),T>_&&(_=T)}n[0]=s,n[1]=r,n[2]=a,n[3]=l,n[4]=o,n[5]=c,i[0]=u,i[1]=p,i[2]=d,i[3]=f,i[4]=m,i[5]=_}var bt=32,cl=(h,t)=>h.candidate-t.candidate,Ft=new Array(bt).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),yn=new Float32Array(6);function Is(h,t,e,n,i,s){let r=-1,a=0;if(s===0)r=Ce(t),r!==-1&&(a=(t[r]+t[r+3])/2);else if(s===1)r=Ce(h),r!==-1&&(a=hl(e,n,i,r));else if(s===2){let l=re(h),o=1.25*i,c=e.offset||0,u=(n-c)*6,p=(n+i-c)*6;for(let d=0;d<3;d++){let f=t[d],g=(t[d+3]-f)/bt;if(i<bt/4){let y=[...Ft];y.length=i;let x=0;for(let S=u;S<p;S+=6,x++){let A=y[x];A.candidate=e[S+2*d],A.count=0;let{bounds:b,leftCacheBounds:w,rightCacheBounds:M}=A;for(let C=0;C<3;C++)M[C]=1/0,M[C+3]=-1/0,w[C]=1/0,w[C+3]=-1/0,b[C]=1/0,b[C+3]=-1/0;Pe(S,e,b)}y.sort(cl);let v=i;for(let S=0;S<v;S++){let A=y[S];for(;S+1<v&&y[S+1].candidate===A.candidate;)y.splice(S+1,1),v--}for(let S=u;S<p;S+=6){let A=e[S+2*d];for(let b=0;b<v;b++){let w=y[b];A>=w.candidate?Pe(S,e,w.rightCacheBounds):(Pe(S,e,w.leftCacheBounds),w.count++)}}for(let S=0;S<v;S++){let A=y[S],b=A.count,w=i-A.count,M=A.leftCacheBounds,C=A.rightCacheBounds,P=0;b!==0&&(P=re(M)/l);let T=0;w!==0&&(T=re(C)/l);let L=1+1.25*(P*b+T*w);L<o&&(r=d,o=L,a=A.candidate)}}else{for(let v=0;v<bt;v++){let S=Ft[v];S.count=0,S.candidate=f+g+v*g;let A=S.bounds;for(let b=0;b<3;b++)A[b]=1/0,A[b+3]=-1/0}for(let v=u;v<p;v+=6){let b=~~((e[v+2*d]-f)/g);b>=bt&&(b=bt-1);let w=Ft[b];w.count++,Pe(v,e,w.bounds)}let y=Ft[bt-1];Ai(y.bounds,y.rightCacheBounds);for(let v=bt-2;v>=0;v--){let S=Ft[v],A=Ft[v+1];Ei(S.bounds,A.rightCacheBounds,S.rightCacheBounds)}let x=0;for(let v=0;v<bt-1;v++){let S=Ft[v],A=S.count,b=S.bounds,M=Ft[v+1].rightCacheBounds;A!==0&&(x===0?Ai(b,yn):Ei(b,yn,yn)),x+=A;let C=0,P=0;x!==0&&(C=re(yn)/l);let T=i-x;T!==0&&(P=re(M)/l);let L=1+1.25*(C*x+P*T);L<o&&(r=d,o=L,a=S.candidate)}}}}else console.warn(\`BVH: Invalid build strategy value \${s} used.\`);return{axis:r,pos:a}}function hl(h,t,e,n){let i=0,s=h.offset;for(let r=t,a=t+e;r<a;r++)i+=h[(r-s)*6+n*2];return i/e}var ae=class{constructor(){this.boundingData=new Float32Array(6)}};function Ls(h,t,e,n,i,s){let r=n,a=n+i-1,l=s.pos,o=s.axis*2,c=e.offset||0;for(;;){for(;r<=a&&e[(r-c)*6+o]<l;)r++;for(;r<=a&&e[(a-c)*6+o]>=l;)a--;if(r<a){for(let u=0;u<t;u++){let p=h[r*t+u];h[r*t+u]=h[a*t+u],h[a*t+u]=p}for(let u=0;u<6;u++){let p=r-c,d=a-c,f=e[p*6+u];e[p*6+u]=e[d*6+u],e[d*6+u]=f}r++,a--}else return r}}var Ds,vn,Ti,Ns,ul=Math.pow(2,32);function Sn(h){return"count"in h?1:1+Sn(h.left)+Sn(h.right)}function Us(h,t,e){return Ds=new Float32Array(e),vn=new Uint32Array(e),Ti=new Uint16Array(e),Ns=new Uint8Array(e),wi(h,t)}function wi(h,t){let e=h/4,n=h/2,i="count"in t,s=t.boundingData;for(let r=0;r<6;r++)Ds[e+r]=s[r];if(i)return t.buffer?(Ns.set(new Uint8Array(t.buffer),h),h+t.buffer.byteLength):(vn[e+6]=t.offset,Ti[n+14]=t.count,Ti[n+15]=65535,h+32);{let{left:r,right:a,splitAxis:l}=t,o=h+32,c=wi(o,r),u=h/32,d=c/32-u;if(d>ul)throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");return vn[e+6]=d,vn[e+7]=l,wi(c,a)}}function fl(h,t,e,n,i,s){let{maxDepth:r,verbose:a,targetLeafSize:l,_strictLeafSize:o=1/0,strategy:c,onProgress:u}=i,p=h.primitiveBuffer,d=h.primitiveBufferStride,f=new Float32Array(6),m=!1,_=new ae;return xn(t,e,n,_.boundingData,f),y(_,e,n,f),_;function g(x){u&&u((x-s.offset)/s.count)}function y(x,v,S,A=null,b=0){!m&&b>=r&&(m=!0,a&&console.warn(\`BVH: Max depth of \${r} reached when generating BVH. Consider increasing maxDepth.\`));let w=S>o;if(S<=l&&!w||b>=r)return g(v+S),x.offset=v,x.count=S,x;let M=Is(x.boundingData,A,t,v,S,c),C=M.axis===-1?-1:Ls(p,d,t,v,S,M);if(M.axis===-1||C===v||C===v+S){if(!w)return g(v+S),x.offset=v,x.count=S,x;M.axis=Math.max(0,Ce(x.boundingData)),C=v+Math.max(1,Math.floor(S/2))}x.splitAxis=M.axis;let P=new ae,T=v,L=C-v;x.left=P,xn(t,T,L,P.boundingData,f),y(P,T,L,f,b+1);let D=new ae,I=C,H=S-L;return x.right=D,xn(t,I,H,D.boundingData,f),y(D,I,H,f,b+1),x}}function Fs(h,t){let e=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,n=h.getRootRanges(t.range),i=n[0],s=n[n.length-1],r={offset:i.offset,count:s.offset+s.count-i.offset},a=new Float32Array(6*r.count);a.offset=r.offset,h.computePrimitiveBounds(r.offset,r.count,a),h._roots=n.map(l=>{let o=fl(h,a,l.offset,l.count,t,r),c=Sn(o),u=new e(32*c);return Us(0,o,u),u})}var Ot=class{constructor(t){this._getNewPrimitive=t,this._primitives=[]}getPrimitive(){let t=this._primitives;return t.length===0?this._getNewPrimitive():t.pop()}releasePrimitive(t){this._primitives.push(t)}};var Ri=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let t=[],e=null;this.setBuffer=n=>{e&&t.push(e),e=n,this.float32Array=new Float32Array(n),this.uint16Array=new Uint16Array(n),this.uint32Array=new Uint32Array(n)},this.clearBuffer=()=>{e=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,t.length!==0&&this.setBuffer(t.pop())}}},At=new Ri;var Bt,le,oe=[],Mn=new Ot(()=>new V);function Os(h,t,e,n,i,s){Bt=Mn.getPrimitive(),le=Mn.getPrimitive(),oe.push(Bt,le),At.setBuffer(h._roots[t]);let r=Ci(0,h.geometry,e,n,i,s);At.clearBuffer(),Mn.releasePrimitive(Bt),Mn.releasePrimitive(le),oe.pop(),oe.pop();let a=oe.length;return a>0&&(le=oe[a-1],Bt=oe[a-2]),r}function Ci(h,t,e,n,i=null,s=0,r=0){let{float32Array:a,uint16Array:l,uint32Array:o}=At,c=h*2;if($(c,l)){let p=j(h,o),d=ht(c,l);return W(h,a,Bt),n(p,d,!1,r,s+h/8,Bt)}else{let C=function(T){let{uint16Array:L,uint32Array:D}=At,I=T*2;for(;!$(I,L);)T=st(T),I=T*2;return j(T,D)},P=function(T){let{uint16Array:L,uint32Array:D}=At,I=T*2;for(;!$(I,L);)T=rt(T,D),I=T*2;return j(T,D)+ht(I,L)},p=st(h),d=rt(h,o),f=p,m=d,_,g,y,x;if(i&&(y=Bt,x=le,W(f,a,y),W(m,a,x),_=i(y),g=i(x),g<_)){f=d,m=p;let T=_;_=g,g=T,y=x}y||(y=Bt,W(f,a,y));let v=$(f*2,l),S=e(y,v,_,r+1,s+f/8),A;if(S===2){let T=C(f),D=P(f)-T;A=n(T,D,!0,r+1,s+f/8,y)}else A=S&&Ci(f,t,e,n,i,s,r+1);if(A)return!0;x=le,W(m,a,x);let b=$(m*2,l),w=e(x,b,g,r+1,s+m/8),M;if(w===2){let T=C(m),D=P(m)-T;M=n(T,D,!0,r+1,s+m/8,x)}else M=w&&Ci(m,t,e,n,i,s,r+1);return!!M}}var Ie=new At.constructor,bn=new At.constructor,zt=new Ot(()=>new V),ce=new V,he=new V,Pi=new V,Ii=new V,Li=!1;function Bs(h,t,e,n){if(Li)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");Li=!0;let i=h._roots,s=t._roots,r,a=0,l=0,o=new K().copy(e).invert();for(let c=0,u=i.length;c<u;c++){Ie.setBuffer(i[c]),l=0;let p=zt.getPrimitive();W(0,Ie.float32Array,p),p.applyMatrix4(o);for(let d=0,f=s.length;d<f&&(bn.setBuffer(s[d]),r=pt(0,0,e,o,n,a,l,0,0,p),bn.clearBuffer(),l+=s[d].byteLength/32,!r);d++);if(zt.releasePrimitive(p),Ie.clearBuffer(),a+=i[c].byteLength/32,r)break}return Li=!1,r}function pt(h,t,e,n,i,s=0,r=0,a=0,l=0,o=null,c=!1){let u,p;c?(u=bn,p=Ie):(u=Ie,p=bn);let d=u.float32Array,f=u.uint32Array,m=u.uint16Array,_=p.float32Array,g=p.uint32Array,y=p.uint16Array,x=h*2,v=t*2,S=$(x,m),A=$(v,y),b=!1;if(A&&S)c?b=i(j(t,g),ht(t*2,y),j(h,f),ht(h*2,m),l,r+t/8,a,s+h/8):b=i(j(h,f),ht(h*2,m),j(t,g),ht(t*2,y),a,s+h/8,l,r+t/8);else if(A){let w=zt.getPrimitive();W(t,_,w),w.applyMatrix4(e);let M=st(h),C=rt(h,f);W(M,d,ce),W(C,d,he);let P=w.intersectsBox(ce),T=w.intersectsBox(he);b=P&&pt(t,M,n,e,i,r,s,l,a+1,w,!c)||T&&pt(t,C,n,e,i,r,s,l,a+1,w,!c),zt.releasePrimitive(w)}else{let w=st(t),M=rt(t,g);W(w,_,Pi),W(M,_,Ii);let C=o.intersectsBox(Pi),P=o.intersectsBox(Ii);if(C&&P)b=pt(h,w,e,n,i,s,r,a,l+1,o,c)||pt(h,M,e,n,i,s,r,a,l+1,o,c);else if(C)if(S)b=pt(h,w,e,n,i,s,r,a,l+1,o,c);else{let T=zt.getPrimitive();T.copy(Pi).applyMatrix4(e);let L=st(h),D=rt(h,f);W(L,d,ce),W(D,d,he);let I=T.intersectsBox(ce),H=T.intersectsBox(he);b=I&&pt(w,L,n,e,i,r,s,l,a+1,T,!c)||H&&pt(w,D,n,e,i,r,s,l,a+1,T,!c),zt.releasePrimitive(T)}else if(P)if(S)b=pt(h,M,e,n,i,s,r,a,l+1,o,c);else{let T=zt.getPrimitive();T.copy(Ii).applyMatrix4(e);let L=st(h),D=rt(h,f);W(L,d,ce),W(D,d,he);let I=T.intersectsBox(ce),H=T.intersectsBox(he);b=I&&pt(M,L,n,e,i,r,s,l,a+1,T,!c)||H&&pt(M,D,n,e,i,r,s,l,a+1,T,!c),zt.releasePrimitive(T)}}return b}var An=new class{constructor(){let h=null,t=null,e=null,n=!1;this.root=null,this.buffer=null,this.uint32Array=null,this.uint16Array=null,this.setBVH=(s,r)=>{if(n)throw new Error("BVHTraversalHelper: cannot call setBVH during an active traversal.");this.root=r,this.buffer=h=s._roots[r],this.uint16Array=e=new Uint16Array(h),this.uint32Array=t=new Uint32Array(h)},this.reset=()=>{this.root=null,this.buffer=h=null,this.uint16Array=e=null,this.uint32Array=t=null},this.getRangeStart=s=>{let r=s*2;for(;!$(r,e);)s=st(s),r=s*2;return j(s,t)},this.getRangeEnd=s=>{let r=s*2;for(;!$(r,e);)s=rt(s,t),r=s*2;return j(s,t)+ht(r,e)};let i=(s,r,a)=>{let l=r*2,o=$(l,e);if(!s(a,o,r)&&!o){let u=st(r),p=rt(r,t);i(s,u,a+1),i(s,p,a+1)}};this.traverseBuffer=s=>{if(n)throw new Error("BVHTraversalHelper: cannot start a traversal during an active traversal.");n=!0;try{i(s,0,0)}finally{n=!1}},this.traverse=s=>{this.traverseBuffer((r,a,l)=>{if(a){let o=l*2,c=t[l+6],u=e[o+14];return s(r,a,new Float32Array(h,l*4,6),c,u)}else{let o=Rs(l,t);return s(r,a,new Float32Array(h,l*4,6),o)}})}}};var zs=new V,ue=new Float32Array(6),En=class{constructor(){this._roots=null,this.primitiveBuffer=null,this.primitiveBufferStride=null}init(t){t={..._n,...t},"maxLeafSize"in t&&(console.warn('BVH: "maxLeafSize" option has been deprecated. Use "targetLeafSize", instead.'),t={...t,targetLeafSize:t.maxLeafSize}),Fs(this,t)}getRootRanges(){throw new Error("BVH: getRootRanges() not implemented")}writePrimitiveBounds(){throw new Error("BVH: writePrimitiveBounds() not implemented")}writePrimitiveRangeBounds(t,e,n,i){let s=1/0,r=1/0,a=1/0,l=-1/0,o=-1/0,c=-1/0;for(let u=t,p=t+e;u<p;u++){this.writePrimitiveBounds(u,ue,0);let[d,f,m,_,g,y]=ue;d<s&&(s=d),_>l&&(l=_),f<r&&(r=f),g>o&&(o=g),m<a&&(a=m),y>c&&(c=y)}return n[i+0]=s,n[i+1]=r,n[i+2]=a,n[i+3]=l,n[i+4]=o,n[i+5]=c,n}computePrimitiveBounds(t,e,n){let i=n.offset||0;for(let s=t,r=t+e;s<r;s++){this.writePrimitiveBounds(s,ue,0);let[a,l,o,c,u,p]=ue,d=(a+c)/2,f=(l+u)/2,m=(o+p)/2,_=(c-a)/2,g=(u-l)/2,y=(p-o)/2,x=(s-i)*6;n[x+0]=d,n[x+1]=_+(Math.abs(d)+_)*mn,n[x+2]=f,n[x+3]=g+(Math.abs(f)+g)*mn,n[x+4]=m,n[x+5]=y+(Math.abs(m)+y)*mn}return n}shiftPrimitiveOffsets(t){let e=this._indirectBuffer;if(e)for(let n=0,i=e.length;n<i;n++)e[n]+=t;else{let n=this._roots;for(let i=0;i<n.length;i++){let s=n[i],r=new Uint32Array(s),a=new Uint16Array(s),l=s.byteLength/32;for(let o=0;o<l;o++){let c=8*o,u=2*c;$(u,a)&&(r[c+6]+=t)}}}}traverse(t,e=0){An.setBVH(this,e),An.traverse(t),An.reset()}refit(){let t=this._roots;for(let e=0,n=t.length;e<n;e++){let i=t[e],s=new Uint32Array(i),r=new Uint16Array(i),a=new Float32Array(i),l=i.byteLength/32;for(let o=l-1;o>=0;o--){let c=o*8,u=c*2;if($(u,r)){let d=j(c,s),f=ht(u,r);this.writePrimitiveRangeBounds(d,f,ue,0),a.set(ue,c)}else{let d=st(c),f=rt(c,s);for(let m=0;m<3;m++){let _=a[d+m],g=a[d+m+3],y=a[f+m],x=a[f+m+3];a[c+m]=_<y?_:y,a[c+m+3]=g>x?g:x}}}}}getBoundingBox(t){return t.makeEmpty(),this._roots.forEach(n=>{W(0,new Float32Array(n),zs),t.union(zs)}),t}shapecast(t){let{boundsTraverseOrder:e,intersectsBounds:n,intersectsRange:i,intersectsPrimitive:s,scratchPrimitive:r,iterate:a}=t;if(i&&s){let u=i;i=(p,d,f,m,_)=>u(p,d,f,m,_)?!0:a(p,d,this,s,f,m,r)}else i||(s?i=(u,p,d,f)=>a(u,p,this,s,d,f,r):i=(u,p,d)=>d);let l=!1,o=0,c=this._roots;for(let u=0,p=c.length;u<p;u++){let d=c[u];if(l=Os(this,u,n,i,e,o),l)break;o+=d.byteLength/32}return l}bvhcast(t,e,n){let{intersectsRanges:i}=n;return Bs(this,t,e,i)}};function Vs(){return typeof SharedArrayBuffer<"u"}function Gs(h){return h.index?h.index.count:h.attributes.position.count}function ml(h,t=ArrayBuffer){return h>65535?new Uint32Array(new t(4*h)):new Uint16Array(new t(2*h))}function ks(h,t){if(!h.index){let e=h.attributes.position.count,n=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,i=ml(e,n);h.setIndex(new ct(i,1));for(let s=0;s<e;s++)i[s]=s}}function gl(h,t,e){let n=Gs(h)/e,i=t||h.drawRange,s=i.start/e,r=(i.start+i.count)/e,a=Math.max(0,s),l=Math.min(n,r)-a;return{offset:Math.floor(a),count:Math.floor(l)}}function _l(h,t){return h.groups.map(e=>({offset:e.start/t,count:e.count/t}))}function Di(h,t,e){let n=gl(h,t,e),i=_l(h,e);if(!i.length)return[n];let s=[],r=n.offset,a=n.offset+n.count,l=Gs(h)/e,o=[];for(let p of i){let{offset:d,count:f}=p,m=d,_=isFinite(f)?f:l-d,g=d+_;m<a&&g>r&&(o.push({pos:Math.max(r,m),isStart:!0}),o.push({pos:Math.min(a,g),isStart:!1}))}o.sort((p,d)=>p.pos!==d.pos?p.pos-d.pos:p.type==="end"?-1:1);let c=0,u=null;for(let p of o){let d=p.pos;c!==0&&d!==u&&s.push({offset:u,count:d-u}),c+=p.isStart?1:-1,u=d}return s}function xl(h,t){let e=h[h.length-1],n=e.offset+e.count>2**16,i=h.reduce((o,c)=>o+c.count,0),s=n?4:2,r=t?new SharedArrayBuffer(i*s):new ArrayBuffer(i*s),a=n?new Uint32Array(r):new Uint16Array(r),l=0;for(let o=0;o<h.length;o++){let{offset:c,count:u}=h[o];for(let p=0;p<u;p++)a[l+p]=c+p;l+=u}return a}var Tn=class extends En{get indirect(){return!!this._indirectBuffer}get primitiveStride(){return null}get primitiveBufferStride(){return this.indirect?1:this.primitiveStride}set primitiveBufferStride(t){}get primitiveBuffer(){return this.indirect?this._indirectBuffer:this.geometry.index.array}set primitiveBuffer(t){}constructor(t,e={}){if(t.isBufferGeometry){if(t.index&&t.index.isInterleavedBufferAttribute)throw new Error("BVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("BVH: Only BufferGeometries are supported.");if(e.useSharedArrayBuffer&&!Vs())throw new Error("BVH: SharedArrayBuffer is not available.");super(),this.geometry=t,this.resolvePrimitiveIndex=e.indirect?n=>this._indirectBuffer[n]:n=>n,this.primitiveBuffer=null,this.primitiveBufferStride=null,this._indirectBuffer=null,e={..._n,...e},e[gn]||this.init(e)}init(t){let{geometry:e,primitiveStride:n}=this;if(t.indirect){let i=Di(e,t.range,n),s=xl(i,t.useSharedArrayBuffer);this._indirectBuffer=s}else ks(e,t);super.init(t),!e.boundingBox&&t.setBoundingBox&&(e.boundingBox=this.getBoundingBox(new V))}getRootRanges(t){return this.indirect?[{offset:0,count:this._indirectBuffer.length}]:Di(this.geometry,t,this.primitiveStride)}raycastObject3D(){throw new Error("BVH: raycastObject3D() not implemented")}};var Ws=new K,Ht=new ie,Xs=new Ot(()=>new E),wn=new V,Ni=new E,Rn=class extends Tn{get primitiveStride(){return 1}writePrimitiveBounds(t,e,n){let i=this._indirectBuffer,{geometry:s}=this,r=s.attributes.position,a=s.index,l=i?i[t]:t;a&&(l=a.getX(l));let o=r.getX(l),c=r.getY(l),u=r.getZ(l);return e[n+0]=o,e[n+1]=c,e[n+2]=u,e[n+3]=o,e[n+4]=c,e[n+5]=u,e}shapecast(t){let e=Xs.getPrimitive(),n=super.shapecast({...t,intersectsPrimitive:t.intersectsPoint,scratchPrimitive:e,iterate:vl});return Xs.releasePrimitive(e),n}raycastObject3D(t,e,n=[]){let{geometry:i}=this,{matrixWorld:s}=t,{firstHitOnly:r}=e;Ws.copy(s).invert(),Ht.copy(e.ray).applyMatrix4(Ws);let l=e.params.Points.threshold/((t.scale.x+t.scale.y+t.scale.z)/3),o=l*l,c=null,u=1/0;return this.shapecast({boundsTraverseOrder:p=>p.distanceToPoint(Ht.origin),intersectsBounds:p=>{if(wn.copy(p).expandByScalar(l),r){if(!Ht.intersectBox(wn,Ni))return 0;let d;return wn.containsPoint(Ht.origin)?d=0:(Ni.applyMatrix4(s),d=e.ray.origin.distanceTo(Ni)),d<u?1:0}else return Ht.intersectsBox(wn)?1:0},intersectsPoint:(p,d)=>{let f=Ht.distanceSqToPoint(p);if(f<o){let m=new E;Ht.closestPointToPoint(p,m),m.applyMatrix4(s);let _=e.ray.origin.distanceTo(m);if(_<e.near||_>e.far||r&&_>=u)return;u=_,d=this.resolvePrimitiveIndex(d),c={distance:_,distanceToRay:Math.sqrt(f),point:m,index:i.index?i.index.getX(d):d,face:null,faceIndex:null,barycoord:null,object:t},r||n.push(c)}}}),r&&c&&n.push(c),n}};function vl(h,t,e,n,i,s,r){let{geometry:a}=e,{index:l}=a,o=a.attributes.position;for(let c=h,u=t+h;c<u;c++){let p=e.resolvePrimitiveIndex(c),d=l?l.array[p]:p;if(r.fromBufferAttribute(o,d),n(r,c,i,s))return!0}return!1}var Sl={strategy:0,indirect:!0,maxDepth:40,targetLeafSize:20},qs=h=>{if(!h.attributes.position)return;let t=new Rn(h,Sl);return{roots:t._roots,indirectBuffer:t._indirectBuffer}};var Ml=new pn,bl=1013904223,Al=h=>{let t=h;return()=>{t=t+1831565813|0;let e=Math.imul(t^t>>>15,t|1);return e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}},El=(h,t,e)=>{let n=Math.floor(h.length/3),i=Math.max(0,Math.min(e,n-1)),s=t!==void 0&&t.length>=n*3,r=Al(bl);for(let a=0;a<i;a++){let l=a+Math.floor(r()*(n-a));if(a===l)continue;let o=a*3,c=l*3;for(let u=0;u<3;u++){let p=h[o+u];if(h[o+u]=h[c+u],h[c+u]=p,s){let d=t[o+u];t[o+u]=t[c+u],t[c+u]=d}}}return i===n-1?n:i},Tl=h=>{if(!h.attributes.position)return;h.computeBoundingBox(),h.computeBoundingSphere();let{boundingBox:t,boundingSphere:e}=h;if(!t||!e)return;let{min:n,max:i}=t,{center:s,radius:r}=e;return{min:{x:n.x,y:n.y,z:n.z},max:{x:i.x,y:i.y,z:i.z},center:{x:s.x,y:s.y,z:s.z},radius:r}};globalThis.onmessage=async h=>{let{data:t,id:e,shuffleDepth:n}=h.data;if(!(t instanceof Uint8Array)){postMessage({id:e,error:"Invalid data format"});return}try{let i=Ml.parse(t.buffer);if(i.geometry){let s=i.geometry.attributes.position?.array??new Float32Array(0),r=i.geometry.attributes.color?.array??void 0,a=r?new Uint8Array(r.length):void 0;if(a)for(let u=0,p=r.length;u<p;u++)a[u]=Math.round(r[u]*255);let l=El(s,a,n),o=qs(i.geometry),c=[s.buffer];a&&c.push(a.buffer),o&&c.push(...o.roots,o.indirectBuffer.buffer),postMessage({positions:s,colors:a,shuffled:l,bounds:Tl(i.geometry),boundsTree:o,id:e},{transfer:c})}else postMessage({id:e,error:"Failed to extract geometry"})}catch(i){postMessage({id:e,error:i.message})}};})();
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
`],{type:`text/javascript`}),Mr=URL.createObjectURL(jr),Nr=new Worker(Mr),Pr=0,Fr=new Map;Nr.addEventListener(`message`,e=>{let{id:t,...n}=e.data,r=Fr.get(t);r&&(Fr.delete(t),`error`in n?r.reject(n.error):r.resolve(n))});var Ir=(e,t=Ar)=>new Promise((n,r)=>{let i=++Pr;Fr.set(i,{resolve:n,reject:r});let a=new Uint8Array(e);Nr.postMessage({id:i,data:a,shuffleDepth:t},[a.buffer])}),Lr=new x,Rr=class extends ce{constructor(e){super(e),this.propertyNameMapping={},this.customPropertyMapping={}}load(e,t,n,r){let i=this,a=new ae(this.manager);a.setPriority(this.priority),a.setCache(this.cache),a.setPath(this.path),a.setResponseType(`arraybuffer`),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(n){try{t(i.parse(n))}catch(t){r?r(t):console.error(t),i.manager.itemError(e)}},n,r)}setPropertyNameMapping(e){this.propertyNameMapping=e}setCustomPropertyNameMapping(e){this.customPropertyMapping=e}parse(e){function t(e,t=0){let n=/^ply([\s\S]*)end_header(\r\n|\r|\n)/,r=``,i=n.exec(e);i!==null&&(r=i[1]);let a={comments:[],elements:[],headerLength:t,objInfo:``},o=r.split(/\r\n|\r|\n/),s;function c(e,t){let n={type:e[0]};return n.type===`list`?(n.name=e[3],n.countType=e[1],n.itemType=e[2]):n.name=e[1],n.name in t&&(n.name=t[n.name]),n}for(let e=0;e<o.length;e++){let t=o[e];if(t=t.trim(),t===``)continue;let n=t.split(/\s+/),r=n.shift();switch(t=n.join(` `),r){case`format`:a.format=n[0],a.version=n[1];break;case`comment`:a.comments.push(t);break;case`element`:s!==void 0&&a.elements.push(s),s={},s.name=n[0],s.count=parseInt(n[1]),s.properties=[];break;case`property`:s.properties.push(c(n,v.propertyNameMapping));break;case`obj_info`:a.objInfo=t;break;default:console.log(`unhandled`,r,n)}}return s!==void 0&&a.elements.push(s),a}function n(e,t){switch(t){case`char`:case`uchar`:case`short`:case`ushort`:case`int`:case`uint`:case`int8`:case`uint8`:case`int16`:case`uint16`:case`int32`:case`uint32`:return parseInt(e);case`float`:case`double`:case`float32`:case`float64`:return parseFloat(e)}}function r(e,t){let r={};for(let i=0;i<e.length;i++){if(t.empty())return null;if(e[i].type===`list`){let a=[],o=n(t.next(),e[i].countType);for(let r=0;r<o;r++){if(t.empty())return null;a.push(n(t.next(),e[i].itemType))}r[e[i].name]=a}else r[e[i].name]=n(t.next(),e[i].type)}return r}function i(){let e={indices:[],vertices:[],normals:[],uvs:[],faceVertexUvs:[],colors:[],faceVertexColors:[],descriptors:{}};for(let t of Object.keys(v.customPropertyMapping))e[t]=[];return e}function a(e){switch(e){case`int8`:case`char`:return me;case`uint8`:case`uchar`:return S;case`int16`:case`short`:return de;case`uint16`:case`ushort`:return oe;case`int32`:case`int`:return fe;case`uint32`:case`uint`:return y;case`float32`:case`float`:return _;case`float64`:case`double`:return zr}}function o(e){switch(e){case`uchar`:case`uint8`:return 1/255;case`ushort`:case`uint16`:return 1/65535;case`float`:case`float32`:case`double`:case`float64`:return 1;default:return 1/255}}function s(e){return e===`float`||e===`float32`||e===`double`||e===`float64`}function c(e){function t(t){for(let n of t){let t=e.find(e=>e.name===n);if(t)return t}return null}let n=t([`x`,`px`,`posx`]),r=t([`y`,`py`,`posy`]),i=t([`z`,`pz`,`posz`]),a=t([`nx`,`normalx`]),o=t([`ny`,`normaly`]),s=t([`nz`,`normalz`]),c=t([`s`,`u`,`texture_u`,`tx`]),l=t([`t`,`v`,`texture_v`,`ty`]),u=t([`red`,`diffuse_red`,`r`,`diffuse_r`]),d=t([`green`,`diffuse_green`,`g`,`diffuse_g`]),f=t([`blue`,`diffuse_blue`,`b`,`diffuse_b`]),p=t([`texcoord`]),m={};for(let t of Object.keys(v.customPropertyMapping)){let n=v.customPropertyMapping[t].map(t=>e.find(e=>e.name===t)),r=n.filter(e=>e).map(e=>e.type);m[t]={type:r.length>0&&r.every(e=>e===r[0])?r[0]:`float32`,usage:n.every(e=>e!==void 0)}}return{position:{names:[n?n.name:`x`,r?r.name:`y`,i?i.name:`z`],type:n?n.type:`float32`,usage:!!(n&&r&&i)},normal:{names:[a?a.name:`nx`,o?o.name:`ny`,s?s.name:`nz`],type:a?a.type:`float32`,usage:!!(a&&o&&s)},uv:{names:[c?c.name:`s`,l?l.name:`t`],type:c?c.type:`float32`,usage:!!(c&&l)},texcoord:{type:p?p.itemType:`float32`,usage:!!p},color:{names:[u?u.name:`red`,d?d.name:`green`,f?f.name:`blue`],type:u?u.type:`uchar`,usage:!!(u&&d&&f)},custom:m}}function l(e,t){let n=i(),a=/end_header\s+(\S[\s\S]*\S|\S)\s*$/,o,s;o=(s=a.exec(e))===null?[]:s[1].split(/\s+/);let l=new Br(o);loop:for(let e=0;e<t.elements.length;e++){let i=t.elements[e],a=c(i.properties);n.descriptors[i.name]=a;for(let e=0;e<i.count;e++){let e=r(i.properties,l);if(!e)break loop;d(n,i.name,e,a)}}return u(n)}function u(e){let t=new w,n=e.descriptors.vertex;e.indices.length>0&&t.setIndex(e.indices);let r=a(n?n.position.type:`float32`);if(t.setAttribute(`position`,new r(e.vertices,3)),e.normals.length>0){let r=a(n.normal.type);t.setAttribute(`normal`,new r(e.normals,3))}if(e.uvs.length>0){let r=a(n.uv.type);t.setAttribute(`uv`,new r(e.uvs,2))}if(e.colors.length>0){let r=n.color.type,i=!s(r),o=a(r);t.setAttribute(`color`,new o(e.colors,3,i))}for(let r of Object.keys(v.customPropertyMapping))if(e[r].length>0){let i=a(n.custom[r].type);t.setAttribute(r,new i(e[r],v.customPropertyMapping[r].length))}if(e.faceVertexUvs.length>0||e.faceVertexColors.length>0){if(t=t.toNonIndexed(),e.faceVertexUvs.length>0){let n=a(e.descriptors.face.texcoord.type);t.setAttribute(`uv`,new n(e.faceVertexUvs,2))}if(e.faceVertexColors.length>0){let n=e.descriptors.face.color.type,r=!s(n),i=a(n);t.setAttribute(`color`,new i(e.faceVertexColors,3,r))}}return t.computeBoundingSphere(),t}function d(e,t,n,r){if(t===`vertex`){let{position:t,normal:i,uv:a,color:c}=r;if(t.usage&&e.vertices.push(n[t.names[0]],n[t.names[1]],n[t.names[2]]),i.usage&&e.normals.push(n[i.names[0]],n[i.names[1]],n[i.names[2]]),a.usage&&e.uvs.push(n[a.names[0]],n[a.names[1]]),c.usage){let t=o(c.type),r=s(c.type);Lr.setRGB(n[c.names[0]]*t,n[c.names[1]]*t,n[c.names[2]]*t,ge);let i=1/t;e.colors.push(r?Lr.r:Math.round(Lr.r*i),r?Lr.g:Math.round(Lr.g*i),r?Lr.b:Math.round(Lr.b*i))}for(let t of Object.keys(v.customPropertyMapping))for(let r of v.customPropertyMapping[t])e[t].push(n[r])}else if(t===`face`){let t=n.vertex_indices||n.vertex_index,i=n.texcoord;t.length===3?(e.indices.push(t[0],t[1],t[2]),i&&i.length===6&&(e.faceVertexUvs.push(i[0],i[1]),e.faceVertexUvs.push(i[2],i[3]),e.faceVertexUvs.push(i[4],i[5]))):t.length===4&&(e.indices.push(t[0],t[1],t[2]),e.indices.push(t[0],t[2],t[3]),i&&i.length===8&&(e.faceVertexUvs.push(i[0],i[1]),e.faceVertexUvs.push(i[2],i[3]),e.faceVertexUvs.push(i[4],i[5]),e.faceVertexUvs.push(i[0],i[1]),e.faceVertexUvs.push(i[4],i[5]),e.faceVertexUvs.push(i[6],i[7])));let{color:a}=r;if(a.usage){let r=o(a.type);Lr.setRGB(n[a.names[0]]*r,n[a.names[1]]*r,n[a.names[2]]*r,ge);let i=1/r,s=Lr.r*i,c=Lr.g*i,l=Lr.b*i;e.faceVertexColors.push(s,c,l),e.faceVertexColors.push(s,c,l),e.faceVertexColors.push(s,c,l),t.length===4&&(e.faceVertexColors.push(s,c,l),e.faceVertexColors.push(s,c,l),e.faceVertexColors.push(s,c,l))}}}function f(e,t){let n={},r=0;for(let i=0;i<t.length;i++){let a=t[i],o=a.valueReader;if(a.type===`list`){let t=[],i=a.countReader.read(e+r);r+=a.countReader.size;for(let n=0;n<i;n++)t.push(o.read(e+r)),r+=o.size;n[a.name]=t}else n[a.name]=o.read(e+r),r+=o.size}return[n,r]}function p(e,t,n){function r(e,t,n){switch(t){case`int8`:case`char`:return{read:t=>e.getInt8(t),size:1};case`uint8`:case`uchar`:return{read:t=>e.getUint8(t),size:1};case`int16`:case`short`:return{read:t=>e.getInt16(t,n),size:2};case`uint16`:case`ushort`:return{read:t=>e.getUint16(t,n),size:2};case`int32`:case`int`:return{read:t=>e.getInt32(t,n),size:4};case`uint32`:case`uint`:return{read:t=>e.getUint32(t,n),size:4};case`float32`:case`float`:return{read:t=>e.getFloat32(t,n),size:4};case`float64`:case`double`:return{read:t=>e.getFloat64(t,n),size:8}}}for(let i=0,a=e.length;i<a;i++){let a=e[i];a.type===`list`?(a.countReader=r(t,a.countType,n),a.valueReader=r(t,a.itemType,n)):a.valueReader=r(t,a.type,n)}}function m(e,t){let n=i(),r=t.format===`binary_little_endian`,a=new DataView(e,t.headerLength),o,s=0;for(let e=0;e<t.elements.length;e++){let i=t.elements[e],l=i.properties,u=c(l);n.descriptors[i.name]=u,p(l,a,r);for(let e=0;e<i.count;e++){o=f(s,l),s+=o[1];let e=o[0];d(n,i.name,e,u)}}return u(n)}function h(e){let t=0,n=!0,r=``,i=[],a=new TextDecoder().decode(e.subarray(0,5)),o=/^ply\r\n/.test(a);do{let a=String.fromCharCode(e[t++]);a!==`
`&&a!==`\r`?r+=a:(r===`end_header`&&(n=!1),r!==``&&(i.push(r),r=``))}while(n&&t<e.length);return o===!0&&t++,{headerText:i.join(`\r`)+`\r`,headerLength:t}}let g,v=this;if(e instanceof ArrayBuffer){let n=new Uint8Array(e),{headerText:r,headerLength:i}=h(n),a=t(r,i);g=a.format===`ascii`?l(new TextDecoder().decode(n),a):m(e,a)}else g=l(e,t(e));return g}},zr=class extends C{constructor(e,t,n){super(new Float64Array(e),t,n)}},Br=class{constructor(e){this.arr=e,this.i=0}empty(){return this.i>=this.arr.length}next(){return this.arr[this.i++]}},Vr=e=>{for(let[t,n]of Object.entries(e.attributes))n instanceof C&&n.array instanceof Float64Array&&e.setAttribute(t,new C(new Float32Array(n.array),n.itemSize,n.normalized));return e},Hr=new Rr,Ur=e=>{if(typeof e==`string`)return Hr.parse(atob(e));if(e.length===0)return new w;if(new TextDecoder().decode(e.slice(0,50)).includes(`format ascii`)){let t=new TextDecoder().decode(e);return Hr.parse(t)}return Hr.parse(An(e))},Wr=e=>Vr(Ur(e)),Gr=new class extends ce{constructor(e){super(e)}load(e,t,n,r){let i=this,a=new ae(this.manager);a.setPriority(this.priority),a.setCache(this.cache),a.setPath(this.path),a.setResponseType(`arraybuffer`),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(n){try{t(i.parse(n))}catch(t){r?r(t):console.error(t),i.manager.itemError(e)}},n,r)}parse(e){function t(e){let t=new DataView(e);if(84+t.getUint32(80,!0)*50===t.byteLength)return!0;let r=[115,111,108,105,100];for(let e=0;e<5;e++)if(n(r,t,e))return!1;return!0}function n(e,t,n){for(let r=0,i=e.length;r<i;r++)if(e[r]!==t.getUint8(n+r))return!1;return!0}function r(e){let t=new DataView(e),n=t.getUint32(80,!0),r,i,a,o=!1,s,c,l,u,d;for(let e=0;e<=70;e++)t.getUint32(e,!1)==1129270351&&t.getUint8(e+4)==82&&t.getUint8(e+5)==61&&(o=!0,s=new Float32Array(n*3*3),c=t.getUint8(e+6)/255,l=t.getUint8(e+7)/255,u=t.getUint8(e+8)/255,d=t.getUint8(e+9)/255);let f=new w,p=new Float32Array(n*3*3),m=new Float32Array(n*3*3),h=new x;for(let e=0;e<n;e++){let n=84+e*50,d=t.getFloat32(n,!0),f=t.getFloat32(n+4,!0),g=t.getFloat32(n+8,!0);if(o){let e=t.getUint16(n+48,!0);e&32768?(r=c,i=l,a=u):(r=(e&31)/31,i=(e>>5&31)/31,a=(e>>10&31)/31)}for(let c=1;c<=3;c++){let l=n+c*12,u=e*3*3+(c-1)*3;p[u]=t.getFloat32(l,!0),p[u+1]=t.getFloat32(l+4,!0),p[u+2]=t.getFloat32(l+8,!0),m[u]=d,m[u+1]=f,m[u+2]=g,o&&(h.setRGB(r,i,a,ge),s[u]=h.r,s[u+1]=h.g,s[u+2]=h.b)}}return f.setAttribute(`position`,new C(p,3)),f.setAttribute(`normal`,new C(m,3)),o&&(f.setAttribute(`color`,new C(s,3)),f.hasColors=!0,f.alpha=d),f}function i(e){let t=new w,n=/solid([\s\S]*?)endsolid/g,r=/facet([\s\S]*?)endfacet/g,i=/solid\s(.+)/,a=0,o=RegExp(`vertex[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)`,`g`),s=RegExp(`normal[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)[\\s]+([+-]?(?:\\d*)(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)`,`g`),c=[],l=[],u=[],d=new D,f,p=0,m=0,h=0;for(;(f=n.exec(e))!==null;){m=h;let e=f[0],n=(f=i.exec(e))===null?``:f[1];for(u.push(n);(f=r.exec(e))!==null;){let e=0,t=0,n=f[0];for(;(f=s.exec(n))!==null;)d.x=parseFloat(f[1]),d.y=parseFloat(f[2]),d.z=parseFloat(f[3]),t++;for(;(f=o.exec(n))!==null;)c.push(parseFloat(f[1]),parseFloat(f[2]),parseFloat(f[3])),l.push(d.x,d.y,d.z),e++,h++;t!==1&&console.error(`THREE.STLLoader: Something isn't right with the normal of face number `+a),e!==3&&console.error(`THREE.STLLoader: Something isn't right with the vertices of face number `+a),a++}let g=m,_=h-m;t.userData.groupNames=u,t.addGroup(g,_,p),p++}return t.setAttribute(`position`,new _(c,3)),t.setAttribute(`normal`,new _(l,3)),t}function a(e){return typeof e==`string`?e:new TextDecoder().decode(e)}function o(e){if(typeof e==`string`){let t=new Uint8Array(e.length);for(let n=0;n<e.length;n++)t[n]=e.charCodeAt(n)&255;return t.buffer||t}else return e}let s=o(e);return t(s)?r(s):i(a(e))}},Kr=84,qr=e=>{try{return Gr.parse(e)}catch{return new w}},Jr=e=>{if(typeof e==`string`){let t;try{t=atob(e)}catch{return new w}return t.length<Kr?new w:qr(t)}return e.byteLength<Kr?new w:qr(e.byteOffset===0&&e.byteLength===e.buffer.byteLength?e.buffer:e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength))},Yr=e=>{let t=(e??``).toLowerCase().split(`;`)[0]?.trim().split(`/`).at(-1);return t===`ply`||t===`stl`?t:void 0},Xr=(e,t)=>Yr(t)===`stl`?Jr(e):Wr(e),Zr=new WeakMap,Qr=e=>{let t=Xr(e.mesh,e.contentType);return Zr.set(t,e),t},$r=(e,t)=>{let n=Zr.get(e);return n!==void 0&&f.Mesh.equals(n,t)},ei=1.25,ti=65535;ti<<16;var ni=2**-24,ri=Symbol(`SKIP_GENERATION`),ii={strategy:0,maxDepth:40,targetLeafSize:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null,[ri]:!1};function R(e,t,n){return n.min.x=t[e],n.min.y=t[e+1],n.min.z=t[e+2],n.max.x=t[e+3],n.max.y=t[e+4],n.max.z=t[e+5],n}function ai(e){let t=-1,n=-1/0;for(let r=0;r<3;r++){let i=e[r+3]-e[r];i>n&&(n=i,t=r)}return t}function oi(e,t){t.set(e)}function si(e,t,n){let r,i;for(let a=0;a<3;a++){let o=a+3;r=e[a],i=t[a],n[a]=r<i?r:i,r=e[o],i=t[o],n[o]=r>i?r:i}}function ci(e,t,n){for(let r=0;r<3;r++){let i=t[e+2*r],a=t[e+2*r+1],o=i-a,s=i+a;o<n[r]&&(n[r]=o),s>n[r+3]&&(n[r+3]=s)}}function li(e){let t=e[3]-e[0],n=e[4]-e[1],r=e[5]-e[2];return 2*(t*n+n*r+r*t)}function z(e,t){return t[e+15]===ti}function B(e,t){return t[e+6]}function V(e,t){return t[e+14]}function H(e){return e+8}function U(e,t){return e+t[e+6]*8}function ui(e,t){return t[e+7]}function W(e){return e}function di(e,t,n,r,i){let a=1/0,o=1/0,s=1/0,c=-1/0,l=-1/0,u=-1/0,d=1/0,f=1/0,p=1/0,m=-1/0,h=-1/0,g=-1/0,_=e.offset||0;for(let r=(t-_)*6,i=(t+n-_)*6;r<i;r+=6){let t=e[r+0],n=e[r+1],i=t-n,_=t+n;i<a&&(a=i),_>c&&(c=_),t<d&&(d=t),t>m&&(m=t);let v=e[r+2],y=e[r+3],b=v-y,x=v+y;b<o&&(o=b),x>l&&(l=x),v<f&&(f=v),v>h&&(h=v);let S=e[r+4],C=e[r+5],ee=S-C,te=S+C;ee<s&&(s=ee),te>u&&(u=te),S<p&&(p=S),S>g&&(g=S)}r[0]=a,r[1]=o,r[2]=s,r[3]=c,r[4]=l,r[5]=u,i[0]=d,i[1]=f,i[2]=p,i[3]=m,i[4]=h,i[5]=g}var fi=32,pi=(e,t)=>e.candidate-t.candidate,mi=Array(fi).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),hi=new Float32Array(6);function gi(e,t,n,r,i,a){let o=-1,s=0;if(a===0)o=ai(t),o!==-1&&(s=(t[o]+t[o+3])/2);else if(a===1)o=ai(e),o!==-1&&(s=_i(n,r,i,o));else if(a===2){let a=li(e),c=ei*i,l=n.offset||0,u=(r-l)*6,d=(r+i-l)*6;for(let e=0;e<3;e++){let r=t[e],l=(t[e+3]-r)/fi;if(i<fi/4){let t=[...mi];t.length=i;let r=0;for(let i=u;i<d;i+=6,r++){let a=t[r];a.candidate=n[i+2*e],a.count=0;let{bounds:o,leftCacheBounds:s,rightCacheBounds:c}=a;for(let e=0;e<3;e++)c[e]=1/0,c[e+3]=-1/0,s[e]=1/0,s[e+3]=-1/0,o[e]=1/0,o[e+3]=-1/0;ci(i,n,o)}t.sort(pi);let l=i;for(let e=0;e<l;e++){let n=t[e];for(;e+1<l&&t[e+1].candidate===n.candidate;)t.splice(e+1,1),l--}for(let r=u;r<d;r+=6){let i=n[r+2*e];for(let e=0;e<l;e++){let a=t[e];i>=a.candidate?ci(r,n,a.rightCacheBounds):(ci(r,n,a.leftCacheBounds),a.count++)}}for(let n=0;n<l;n++){let r=t[n],l=r.count,u=i-r.count,d=r.leftCacheBounds,f=r.rightCacheBounds,p=0;l!==0&&(p=li(d)/a);let m=0;u!==0&&(m=li(f)/a);let h=1+ei*(p*l+m*u);h<c&&(o=e,c=h,s=r.candidate)}}else{for(let e=0;e<fi;e++){let t=mi[e];t.count=0,t.candidate=r+l+e*l;let n=t.bounds;for(let e=0;e<3;e++)n[e]=1/0,n[e+3]=-1/0}for(let t=u;t<d;t+=6){let i=~~((n[t+2*e]-r)/l);i>=fi&&(i=fi-1);let a=mi[i];a.count++,ci(t,n,a.bounds)}let t=mi[fi-1];oi(t.bounds,t.rightCacheBounds);for(let e=fi-2;e>=0;e--){let t=mi[e],n=mi[e+1];si(t.bounds,n.rightCacheBounds,t.rightCacheBounds)}let f=0;for(let t=0;t<fi-1;t++){let n=mi[t],r=n.count,l=n.bounds,u=mi[t+1].rightCacheBounds;r!==0&&(f===0?oi(l,hi):si(l,hi,hi)),f+=r;let d=0,p=0;f!==0&&(d=li(hi)/a);let m=i-f;m!==0&&(p=li(u)/a);let h=1+ei*(d*f+p*m);h<c&&(o=e,c=h,s=n.candidate)}}}}else console.warn(`BVH: Invalid build strategy value ${a} used.`);return{axis:o,pos:s}}function _i(e,t,n,r){let i=0,a=e.offset;for(let o=t,s=t+n;o<s;o++)i+=e[(o-a)*6+r*2];return i/n}var vi=class{constructor(){this.boundingData=new Float32Array(6)}};function yi(e,t,n,r,i,a){let o=r,s=r+i-1,c=a.pos,l=a.axis*2,u=n.offset||0;for(;;){for(;o<=s&&n[(o-u)*6+l]<c;)o++;for(;o<=s&&n[(s-u)*6+l]>=c;)s--;if(o<s){for(let n=0;n<t;n++){let r=e[o*t+n];e[o*t+n]=e[s*t+n],e[s*t+n]=r}for(let e=0;e<6;e++){let t=o-u,r=s-u,i=n[t*6+e];n[t*6+e]=n[r*6+e],n[r*6+e]=i}o++,s--}else return o}}var bi,xi,Si,Ci,wi=2**32;function Ti(e){return`count`in e?1:1+Ti(e.left)+Ti(e.right)}function Ei(e,t,n){return bi=new Float32Array(n),xi=new Uint32Array(n),Si=new Uint16Array(n),Ci=new Uint8Array(n),Di(e,t)}function Di(e,t){let n=e/4,r=e/2,i=`count`in t,a=t.boundingData;for(let e=0;e<6;e++)bi[n+e]=a[e];if(i)return t.buffer?(Ci.set(new Uint8Array(t.buffer),e),e+t.buffer.byteLength):(xi[n+6]=t.offset,Si[r+14]=t.count,Si[r+15]=ti,e+32);{let{left:r,right:i,splitAxis:a}=t,o=Di(e+32,r),s=e/32,c=o/32-s;if(c>wi)throw Error(`MeshBVH: Cannot store relative child node offset greater than 32 bits.`);return xi[n+6]=c,xi[n+7]=a,Di(o,i)}}function Oi(e,t,n,r,i,a){let{maxDepth:o,verbose:s,targetLeafSize:c,_strictLeafSize:l=1/0,strategy:u,onProgress:d}=i,f=e.primitiveBuffer,p=e.primitiveBufferStride,m=new Float32Array(6),h=!1,g=new vi;return di(t,n,r,g.boundingData,m),v(g,n,r,m),g;function _(e){d&&d((e-a.offset)/a.count)}function v(e,n,r,i=null,a=0){!h&&a>=o&&(h=!0,s&&console.warn(`BVH: Max depth of ${o} reached when generating BVH. Consider increasing maxDepth.`));let d=r>l;if(r<=c&&!d||a>=o)return _(n+r),e.offset=n,e.count=r,e;let g=gi(e.boundingData,i,t,n,r,u),y=g.axis===-1?-1:yi(f,p,t,n,r,g);if(g.axis===-1||y===n||y===n+r){if(!d)return _(n+r),e.offset=n,e.count=r,e;g.axis=Math.max(0,ai(e.boundingData)),y=n+Math.max(1,Math.floor(r/2))}e.splitAxis=g.axis;let b=new vi,x=n,S=y-n;e.left=b,di(t,x,S,b.boundingData,m),v(b,x,S,m,a+1);let C=new vi,ee=y,te=r-S;return e.right=C,di(t,ee,te,C.boundingData,m),v(C,ee,te,m,a+1),e}}function ki(e,t){let n=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,r=e.getRootRanges(t.range),i=r[0],a=r[r.length-1],o={offset:i.offset,count:a.offset+a.count-i.offset},s=new Float32Array(6*o.count);s.offset=o.offset,e.computePrimitiveBounds(o.offset,o.count,s),e._roots=r.map(r=>{let i=Oi(e,s,r.offset,r.count,t,o),a=Ti(i),c=new n(32*a);return Ei(0,i,c),c})}var Ai=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}},G=new class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=n=>{t&&e.push(t),t=n,this.float32Array=new Float32Array(n),this.uint16Array=new Uint16Array(n),this.uint32Array=new Uint32Array(n)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},ji,Mi,Ni=[],Pi=new Ai(()=>new E);function Fi(e,t,n,r,i,a){ji=Pi.getPrimitive(),Mi=Pi.getPrimitive(),Ni.push(ji,Mi),G.setBuffer(e._roots[t]);let o=Ii(0,e.geometry,n,r,i,a);G.clearBuffer(),Pi.releasePrimitive(ji),Pi.releasePrimitive(Mi),Ni.pop(),Ni.pop();let s=Ni.length;return s>0&&(Mi=Ni[s-1],ji=Ni[s-2]),o}function Ii(e,t,n,r,i=null,a=0,o=0){let{float32Array:s,uint16Array:c,uint32Array:l}=G,u=e*2;if(z(u,c)){let t=B(e,l),n=V(u,c);return R(W(e),s,ji),r(t,n,!1,o,a+e/8,ji)}else{let u=H(e),d=U(e,l),f=u,p=d,m,h,g,_;if(i&&(g=ji,_=Mi,R(W(f),s,g),R(W(p),s,_),m=i(g),h=i(_),h<m)){f=d,p=u;let e=m;m=h,h=e,g=_}g||(g=ji,R(W(f),s,g));let v=z(f*2,c),y=n(g,v,m,o+1,a+f/8),b;if(y===2){let e=ee(f);b=r(e,te(f)-e,!0,o+1,a+f/8,g)}else b=y&&Ii(f,t,n,r,i,a,o+1);if(b)return!0;_=Mi,R(W(p),s,_);let x=z(p*2,c),S=n(_,x,h,o+1,a+p/8),C;if(S===2){let e=ee(p);C=r(e,te(p)-e,!0,o+1,a+p/8,_)}else C=S&&Ii(p,t,n,r,i,a,o+1);if(C)return!0;return!1;function ee(e){let{uint16Array:t,uint32Array:n}=G,r=e*2;for(;!z(r,t);)e=H(e),r=e*2;return B(e,n)}function te(e){let{uint16Array:t,uint32Array:n}=G,r=e*2;for(;!z(r,t);)e=U(e,n),r=e*2;return B(e,n)+V(r,t)}}}var Li=new G.constructor,Ri=new G.constructor,zi=new Ai(()=>new E),Bi=new E,Vi=new E,Hi=new E,Ui=new E,Wi=!1;function Gi(e,t,n,r){if(Wi)throw Error(`MeshBVH: Recursive calls to bvhcast not supported.`);Wi=!0;let i=e._roots,a=t._roots,o,s=0,c=0,l=new O().copy(n).invert();for(let e=0,t=i.length;e<t;e++){Li.setBuffer(i[e]),c=0;let t=zi.getPrimitive();R(W(0),Li.float32Array,t),t.applyMatrix4(l);for(let e=0,i=a.length;e<i&&(Ri.setBuffer(a[e]),o=Ki(0,0,n,l,r,s,c,0,0,t),Ri.clearBuffer(),c+=a[e].byteLength/32,!o);e++);if(zi.releasePrimitive(t),Li.clearBuffer(),s+=i[e].byteLength/32,o)break}return Wi=!1,o}function Ki(e,t,n,r,i,a=0,o=0,s=0,c=0,l=null,u=!1){let d,f;u?(d=Ri,f=Li):(d=Li,f=Ri);let p=d.float32Array,m=d.uint32Array,h=d.uint16Array,g=f.float32Array,_=f.uint32Array,v=f.uint16Array,y=e*2,b=t*2,x=z(y,h),S=z(b,v),C=!1;if(S&&x)C=u?i(B(t,_),V(t*2,v),B(e,m),V(e*2,h),c,o+t/8,s,a+e/8):i(B(e,m),V(e*2,h),B(t,_),V(t*2,v),s,a+e/8,c,o+t/8);else if(S){let l=zi.getPrimitive();R(W(t),g,l),l.applyMatrix4(n);let d=H(e),f=U(e,m);R(W(d),p,Bi),R(W(f),p,Vi);let h=l.intersectsBox(Bi),_=l.intersectsBox(Vi);C=h&&Ki(t,d,r,n,i,o,a,c,s+1,l,!u)||_&&Ki(t,f,r,n,i,o,a,c,s+1,l,!u),zi.releasePrimitive(l)}else{let d=H(t),f=U(t,_);R(W(d),g,Hi),R(W(f),g,Ui);let h=l.intersectsBox(Hi),v=l.intersectsBox(Ui);if(h&&v)C=Ki(e,d,n,r,i,a,o,s,c+1,l,u)||Ki(e,f,n,r,i,a,o,s,c+1,l,u);else if(h)if(x)C=Ki(e,d,n,r,i,a,o,s,c+1,l,u);else{let t=zi.getPrimitive();t.copy(Hi).applyMatrix4(n);let l=H(e),f=U(e,m);R(W(l),p,Bi),R(W(f),p,Vi);let h=t.intersectsBox(Bi),g=t.intersectsBox(Vi);C=h&&Ki(d,l,r,n,i,o,a,c,s+1,t,!u)||g&&Ki(d,f,r,n,i,o,a,c,s+1,t,!u),zi.releasePrimitive(t)}else if(v)if(x)C=Ki(e,f,n,r,i,a,o,s,c+1,l,u);else{let t=zi.getPrimitive();t.copy(Ui).applyMatrix4(n);let l=H(e),d=U(e,m);R(W(l),p,Bi),R(W(d),p,Vi);let h=t.intersectsBox(Bi),g=t.intersectsBox(Vi);C=h&&Ki(f,l,r,n,i,o,a,c,s+1,t,!u)||g&&Ki(f,d,r,n,i,o,a,c,s+1,t,!u),zi.releasePrimitive(t)}}return C}var qi=new class{constructor(){let e=null,t=null,n=null,r=!1;this.root=null,this.buffer=null,this.uint32Array=null,this.uint16Array=null,this.setBVH=(i,a)=>{if(r)throw Error(`BVHTraversalHelper: cannot call setBVH during an active traversal.`);this.root=a,this.buffer=e=i._roots[a],this.uint16Array=n=new Uint16Array(e),this.uint32Array=t=new Uint32Array(e)},this.reset=()=>{this.root=null,this.buffer=e=null,this.uint16Array=n=null,this.uint32Array=t=null},this.getRangeStart=e=>{let r=e*2;for(;!z(r,n);)e=H(e),r=e*2;return B(e,t)},this.getRangeEnd=e=>{let r=e*2;for(;!z(r,n);)e=U(e,t),r=e*2;return B(e,t)+V(r,n)};let i=(e,r,a)=>{let o=z(r*2,n);if(!e(a,o,r)&&!o){let n=H(r),o=U(r,t);i(e,n,a+1),i(e,o,a+1)}};this.traverseBuffer=e=>{if(r)throw Error(`BVHTraversalHelper: cannot start a traversal during an active traversal.`);r=!0;try{i(e,0,0)}finally{r=!1}},this.traverse=r=>{this.traverseBuffer((i,a,o)=>{if(a){let s=o*2,c=t[o+6],l=n[s+14];return r(i,a,new Float32Array(e,o*4,6),c,l)}else{let n=ui(o,t);return r(i,a,new Float32Array(e,o*4,6),n)}})}}},Ji=new E,Yi=new Float32Array(6),Xi=class{constructor(){this._roots=null,this.primitiveBuffer=null,this.primitiveBufferStride=null}init(e){e={...ii,...e},`maxLeafSize`in e&&(console.warn(`BVH: "maxLeafSize" option has been deprecated. Use "targetLeafSize", instead.`),e={...e,targetLeafSize:e.maxLeafSize}),ki(this,e)}getRootRanges(){throw Error(`BVH: getRootRanges() not implemented`)}writePrimitiveBounds(){throw Error(`BVH: writePrimitiveBounds() not implemented`)}writePrimitiveRangeBounds(e,t,n,r){let i=1/0,a=1/0,o=1/0,s=-1/0,c=-1/0,l=-1/0;for(let n=e,r=e+t;n<r;n++){this.writePrimitiveBounds(n,Yi,0);let[e,t,r,u,d,f]=Yi;e<i&&(i=e),u>s&&(s=u),t<a&&(a=t),d>c&&(c=d),r<o&&(o=r),f>l&&(l=f)}return n[r+0]=i,n[r+1]=a,n[r+2]=o,n[r+3]=s,n[r+4]=c,n[r+5]=l,n}computePrimitiveBounds(e,t,n){let r=n.offset||0;for(let i=e,a=e+t;i<a;i++){this.writePrimitiveBounds(i,Yi,0);let[e,t,a,o,s,c]=Yi,l=(e+o)/2,u=(t+s)/2,d=(a+c)/2,f=(o-e)/2,p=(s-t)/2,m=(c-a)/2,h=(i-r)*6;n[h+0]=l,n[h+1]=f+(Math.abs(l)+f)*ni,n[h+2]=u,n[h+3]=p+(Math.abs(u)+p)*ni,n[h+4]=d,n[h+5]=m+(Math.abs(d)+m)*ni}return n}shiftPrimitiveOffsets(e){let t=this._indirectBuffer;if(t)for(let n=0,r=t.length;n<r;n++)t[n]+=e;else{let t=this._roots;for(let n=0;n<t.length;n++){let r=t[n],i=new Uint32Array(r),a=new Uint16Array(r),o=r.byteLength/32;for(let t=0;t<o;t++){let n=8*t;z(2*n,a)&&(i[n+6]+=e)}}}}traverse(e,t=0){qi.setBVH(this,t),qi.traverse(e),qi.reset()}refit(){let e=this._roots;for(let t=0,n=e.length;t<n;t++){let n=e[t],r=new Uint32Array(n),i=new Uint16Array(n),a=new Float32Array(n),o=n.byteLength/32;for(let e=o-1;e>=0;e--){let t=e*8,n=t*2;if(z(n,i)){let e=B(t,r),o=V(n,i);this.writePrimitiveRangeBounds(e,o,Yi,0),a.set(Yi,t)}else{let e=H(t),n=U(t,r);for(let r=0;r<3;r++){let i=a[e+r],o=a[e+r+3],s=a[n+r],c=a[n+r+3];a[t+r]=i<s?i:s,a[t+r+3]=o>c?o:c}}}}}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(t=>{R(0,new Float32Array(t),Ji),e.union(Ji)}),e}shapecast(e){let{boundsTraverseOrder:t,intersectsBounds:n,intersectsRange:r,intersectsPrimitive:i,scratchPrimitive:a,iterate:o}=e;if(r&&i){let e=r;r=(t,n,r,s,c)=>e(t,n,r,s,c)?!0:o(t,n,this,i,r,s,a)}else r||=i?(e,t,n,r)=>o(e,t,this,i,n,r,a):(e,t,n)=>n;let s=!1,c=0,l=this._roots;for(let e=0,i=l.length;e<i;e++){let i=l[e];if(s=Fi(this,e,n,r,t,c),s)break;c+=i.byteLength/32}return s}bvhcast(e,t,n){let{intersectsRanges:r}=n;return Gi(this,e,t,r)}};function Zi(){return typeof SharedArrayBuffer<`u`}function Qi(e){return e.index?e.index.count:e.attributes.position.count}function $i(e){return Qi(e)/3}function ea(e,t=ArrayBuffer){return e>65535?new Uint32Array(new t(4*e)):new Uint16Array(new t(2*e))}function ta(e,t){if(!e.index){let n=e.attributes.position.count,r=ea(n,t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer);e.setIndex(new C(r,1));for(let e=0;e<n;e++)r[e]=e}}function na(e,t,n){let r=Qi(e)/n,i=t||e.drawRange,a=i.start/n,o=(i.start+i.count)/n,s=Math.max(0,a),c=Math.min(r,o)-s;return{offset:Math.floor(s),count:Math.floor(c)}}function ra(e,t){return e.groups.map(e=>({offset:e.start/t,count:e.count/t}))}function ia(e,t,n){let r=na(e,t,n),i=ra(e,n);if(!i.length)return[r];let a=[],o=r.offset,s=r.offset+r.count,c=Qi(e)/n,l=[];for(let e of i){let{offset:t,count:n}=e,r=t,i=t+(isFinite(n)?n:c-t);r<s&&i>o&&(l.push({pos:Math.max(o,r),isStart:!0}),l.push({pos:Math.min(s,i),isStart:!1}))}l.sort((e,t)=>e.pos===t.pos?e.type===`end`?-1:1:e.pos-t.pos);let u=0,d=null;for(let e of l){let t=e.pos;u!==0&&t!==d&&a.push({offset:d,count:t-d}),u+=e.isStart?1:-1,d=t}return a}function aa(e,t){let n=e[e.length-1],r=n.offset+n.count>2**16,i=e.reduce((e,t)=>e+t.count,0),a=r?4:2,o=t?new SharedArrayBuffer(i*a):new ArrayBuffer(i*a),s=r?new Uint32Array(o):new Uint16Array(o),c=0;for(let t=0;t<e.length;t++){let{offset:n,count:r}=e[t];for(let e=0;e<r;e++)s[c+e]=n+e;c+=r}return s}var oa=class extends Xi{get indirect(){return!!this._indirectBuffer}get primitiveStride(){return null}get primitiveBufferStride(){return this.indirect?1:this.primitiveStride}set primitiveBufferStride(e){}get primitiveBuffer(){return this.indirect?this._indirectBuffer:this.geometry.index.array}set primitiveBuffer(e){}constructor(e,t={}){if(!e.isBufferGeometry)throw Error(`BVH: Only BufferGeometries are supported.`);if(e.index&&e.index.isInterleavedBufferAttribute)throw Error(`BVH: InterleavedBufferAttribute is not supported for the index attribute.`);if(t.useSharedArrayBuffer&&!Zi())throw Error(`BVH: SharedArrayBuffer is not available.`);super(),this.geometry=e,this.resolvePrimitiveIndex=t.indirect?e=>this._indirectBuffer[e]:e=>e,this.primitiveBuffer=null,this.primitiveBufferStride=null,this._indirectBuffer=null,t={...ii,...t},t[ri]||this.init(t)}init(e){let{geometry:t,primitiveStride:n}=this;if(e.indirect){let r=aa(ia(t,e.range,n),e.useSharedArrayBuffer);this._indirectBuffer=r}else ta(t,e);super.init(e),!t.boundingBox&&e.setBoundingBox&&(t.boundingBox=this.getBoundingBox(new E))}getRootRanges(e){return this.indirect?[{offset:0,count:this._indirectBuffer.length}]:ia(this.geometry,e,this.primitiveStride)}raycastObject3D(){throw Error(`BVH: raycastObject3D() not implemented`)}},sa=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let n=1/0,r=-1/0;for(let i=0,a=e.length;i<a;i++){let a=e[i][t];n=a<n?a:n,r=a>r?a:r}this.min=n,this.max=r}setFromPoints(e,t){let n=1/0,r=-1/0;for(let i=0,a=t.length;i<a;i++){let a=t[i],o=e.dot(a);n=o<n?o:n,r=o>r?o:r}this.min=n,this.max=r}isSeparated(e){return this.min>e.max||e.min>this.max}};sa.prototype.setFromBox=(function(){let e=new D;return function(t,n){let r=n.min,i=n.max,a=1/0,o=-1/0;for(let n=0;n<=1;n++)for(let s=0;s<=1;s++)for(let c=0;c<=1;c++){e.x=r.x*n+i.x*(1-n),e.y=r.y*s+i.y*(1-s),e.z=r.z*c+i.z*(1-c);let l=t.dot(e);a=Math.min(l,a),o=Math.max(l,o)}this.min=a,this.max=o}})();var ca=(function(){let e=new D,t=new D,n=new D;return function(r,i,a){let o=r.start,s=e,c=i.start,l=t;n.subVectors(o,c),e.subVectors(r.end,r.start),t.subVectors(i.end,i.start);let u=n.dot(l),d=l.dot(s),f=l.dot(l),p=n.dot(s),m=s.dot(s)*f-d*d,h,g;h=m===0?0:(u*d-p*f)/m,g=(u+h*d)/f,a.x=h,a.y=g}})(),la=(function(){let e=new le,t=new D,n=new D;return function(r,i,a,o){ca(r,i,e);let s=e.x,c=e.y;if(s>=0&&s<=1&&c>=0&&c<=1){r.at(s,a),i.at(c,o);return}else if(s>=0&&s<=1){c<0?i.at(0,o):i.at(1,o),r.closestPointToPoint(o,!0,a);return}else if(c>=0&&c<=1){s<0?r.at(0,a):r.at(1,a),i.closestPointToPoint(a,!0,o);return}else{let e;e=s<0?r.start:r.end;let l;l=c<0?i.start:i.end;let u=t,d=n;if(r.closestPointToPoint(l,!0,t),i.closestPointToPoint(e,!0,n),u.distanceToSquared(l)<=d.distanceToSquared(e)){a.copy(u),o.copy(l);return}else{a.copy(e),o.copy(d);return}}}})(),ua=(function(){let e=new D,t=new D,n=new te,r=new ne;return function(i,a){let{radius:o,center:s}=i,{a:c,b:l,c:u}=a;if(r.start=c,r.end=l,r.closestPointToPoint(s,!0,e).distanceTo(s)<=o||(r.start=c,r.end=u,r.closestPointToPoint(s,!0,e).distanceTo(s)<=o)||(r.start=l,r.end=u,r.closestPointToPoint(s,!0,e).distanceTo(s)<=o))return!0;let d=a.getPlane(n);if(Math.abs(d.distanceToPoint(s))<=o){let e=d.projectPoint(s,t);if(a.containsPoint(e))return!0}return!1}})(),da=[`x`,`y`,`z`],fa=1e-15,pa=fa*fa;function ma(e){return Math.abs(e)<fa}var ha=class extends b{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=[,,,,].fill().map(()=>new D),this.satBounds=[,,,,].fill().map(()=>new sa),this.points=[this.a,this.b,this.c],this.plane=new te,this.isDegenerateIntoSegment=!1,this.isDegenerateIntoPoint=!1,this.degenerateSegment=new ne,this.needsUpdate=!0}intersectsSphere(e){return ua(e,this)}update(){let e=this.a,t=this.b,n=this.c,r=this.points,i=this.satAxes,a=this.satBounds,o=i[0],s=a[0];this.getNormal(o),s.setFromPoints(o,r);let c=i[1],l=a[1];c.subVectors(e,t),l.setFromPoints(c,r);let u=i[2],d=a[2];u.subVectors(t,n),d.setFromPoints(u,r);let f=i[3],p=a[3];f.subVectors(n,e),p.setFromPoints(f,r);let m=c.length(),h=u.length(),g=f.length();this.isDegenerateIntoPoint=!1,this.isDegenerateIntoSegment=!1,m<fa?h<fa||g<fa?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(e),this.degenerateSegment.end.copy(n)):h<fa?g<fa?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(t),this.degenerateSegment.end.copy(e)):g<fa&&(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(n),this.degenerateSegment.end.copy(t)),this.plane.setFromNormalAndCoplanarPoint(o,e),this.needsUpdate=!1}};ha.prototype.closestPointToSegment=(function(){let e=new D,t=new D,n=new ne;return function(r,i=null,a=null){let{start:o,end:s}=r,c=this.points,l,u=1/0;for(let o=0;o<3;o++){let s=(o+1)%3;n.start.copy(c[o]),n.end.copy(c[s]),la(n,r,e,t),l=e.distanceToSquared(t),l<u&&(u=l,i&&i.copy(e),a&&a.copy(t))}return this.closestPointToPoint(o,e),l=o.distanceToSquared(e),l<u&&(u=l,i&&i.copy(e),a&&a.copy(o)),this.closestPointToPoint(s,e),l=s.distanceToSquared(e),l<u&&(u=l,i&&i.copy(e),a&&a.copy(s)),Math.sqrt(u)}})(),ha.prototype.intersectsTriangle=(function(){let e=new ha,t=new sa,n=new sa,r=new D,i=new D,a=new D,o=new D,s=new ne,c=new ne,l=new D,u=new le,d=new le;function f(e,i,a,s){let c=r;!e.isDegenerateIntoPoint&&!e.isDegenerateIntoSegment?c.copy(e.plane.normal):c.copy(i.plane.normal);let l=e.satBounds,u=e.satAxes;for(let r=1;r<4;r++){let a=l[r],s=u[r];if(t.setFromPoints(s,i.points),a.isSeparated(t)||(o.copy(c).cross(s),t.setFromPoints(o,e.points),n.setFromPoints(o,i.points),t.isSeparated(n)))return!1}let d=i.satBounds,f=i.satAxes;for(let r=1;r<4;r++){let a=d[r],s=f[r];if(t.setFromPoints(s,e.points),a.isSeparated(t)||(o.crossVectors(c,s),t.setFromPoints(o,e.points),n.setFromPoints(o,i.points),t.isSeparated(n)))return!1}return a&&(s||console.warn(`ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0.`),a.start.set(0,0,0),a.end.set(0,0,0)),!0}function p(e,t,n,r,i,a,o,s,c,l,u){let d=o/(o-s);l.x=r+(i-r)*d,u.start.subVectors(t,e).multiplyScalar(d).add(e),d=o/(o-c),l.y=r+(a-r)*d,u.end.subVectors(n,e).multiplyScalar(d).add(e)}function m(e,t,n,r,i,a,o,s,c,l,u){if(i>0)p(e.c,e.a,e.b,r,t,n,c,o,s,l,u);else if(a>0)p(e.b,e.a,e.c,n,t,r,s,o,c,l,u);else if(s*c>0||o!=0)p(e.a,e.b,e.c,t,n,r,o,s,c,l,u);else if(s!=0)p(e.b,e.a,e.c,n,t,r,s,o,c,l,u);else if(c!=0)p(e.c,e.a,e.b,r,t,n,c,o,s,l,u);else return!0;return!1}function h(e,t,n,i){let a=t.degenerateSegment,o=e.plane.distanceToPoint(a.start),s=e.plane.distanceToPoint(a.end);return ma(o)?ma(s)?f(e,t,n,i):(n&&(n.start.copy(a.start),n.end.copy(a.start)),e.containsPoint(a.start)):ma(s)?(n&&(n.start.copy(a.end),n.end.copy(a.end)),e.containsPoint(a.end)):e.plane.intersectLine(a,r)==null?!1:(n&&(n.start.copy(r),n.end.copy(r)),e.containsPoint(r))}function g(e,t,n){let r=t.a;return ma(e.plane.distanceToPoint(r))&&e.containsPoint(r)?(n&&(n.start.copy(r),n.end.copy(r)),!0):!1}function _(e,t,n){let i=e.degenerateSegment,a=t.a;return i.closestPointToPoint(a,!0,r),a.distanceToSquared(r)<pa?(n&&(n.start.copy(a),n.end.copy(a)),!0):!1}function v(e,t,n,o){if(e.isDegenerateIntoSegment)if(t.isDegenerateIntoSegment){let o=e.degenerateSegment,s=t.degenerateSegment,c=i,l=a;o.delta(c),s.delta(l);let u=r.subVectors(s.start,o.start),d=c.x*l.y-c.y*l.x;if(ma(d))return!1;let f=(u.x*l.y-u.y*l.x)/d,p=-(c.x*u.y-c.y*u.x)/d;return f<0||f>1||p<0||p>1?!1:ma(o.start.z+c.z*f-(s.start.z+l.z*p))?(n&&(n.start.copy(o.start).addScaledVector(c,f),n.end.copy(o.start).addScaledVector(c,f)),!0):!1}else if(t.isDegenerateIntoPoint)return _(e,t,n);else return h(t,e,n,o);else if(e.isDegenerateIntoPoint)return t.isDegenerateIntoPoint?t.a.distanceToSquared(e.a)<pa?(n&&(n.start.copy(e.a),n.end.copy(e.a)),!0):!1:t.isDegenerateIntoSegment?_(t,e,n):g(t,e,n);else if(t.isDegenerateIntoPoint)return g(e,t,n);else if(t.isDegenerateIntoSegment)return h(e,t,n,o)}return function(t,n=null,r=!1){this.needsUpdate&&this.update(),t.isExtendedTriangle?t.needsUpdate&&t.update():(e.copy(t),e.update(),t=e);let o=v(this,t,n,r);if(o!==void 0)return o;let p=this.plane,h=t.plane,g=h.distanceToPoint(this.a),_=h.distanceToPoint(this.b),y=h.distanceToPoint(this.c);ma(g)&&(g=0),ma(_)&&(_=0),ma(y)&&(y=0);let b=g*_,x=g*y;if(b>0&&x>0)return!1;let S=p.distanceToPoint(t.a),C=p.distanceToPoint(t.b),ee=p.distanceToPoint(t.c);ma(S)&&(S=0),ma(C)&&(C=0),ma(ee)&&(ee=0);let te=S*C,w=S*ee;if(te>0&&w>0)return!1;i.copy(p.normal),a.copy(h.normal);let ne=i.cross(a),re=0,ie=Math.abs(ne.x),ae=Math.abs(ne.y);ae>ie&&(ie=ae,re=1),Math.abs(ne.z)>ie&&(re=2);let oe=da[re],se=this.a[oe],ce=this.b[oe],le=this.c[oe],ue=t.a[oe],de=t.b[oe],fe=t.c[oe];if(m(this,se,ce,le,b,x,g,_,y,u,s)||m(t,ue,de,fe,te,w,S,C,ee,d,c))return f(this,t,n,r);if(u.y<u.x){let e=u.y;u.y=u.x,u.x=e,l.copy(s.start),s.start.copy(s.end),s.end.copy(l)}if(d.y<d.x){let e=d.y;d.y=d.x,d.x=e,l.copy(c.start),c.start.copy(c.end),c.end.copy(l)}return u.y<d.x||d.y<u.x?!1:(n&&(d.x>u.x?n.start.copy(c.start):n.start.copy(s.start),d.y<u.y?n.end.copy(c.end):n.end.copy(s.end)),!0)}})(),ha.prototype.distanceToPoint=(function(){let e=new D;return function(t){return this.closestPointToPoint(t,e),t.distanceTo(e)}})(),ha.prototype.distanceToTriangle=(function(){let e=new D,t=new D,n=[`a`,`b`,`c`],r=new ne,i=new ne;return function(a,o=null,s=null){let c=o||s?r:null;if(this.intersectsTriangle(a,c,!0))return(o||s)&&(o&&c.getCenter(o),s&&c.getCenter(s)),0;let l=1/0;for(let t=0;t<3;t++){let r,i=n[t],c=a[i];this.closestPointToPoint(c,e),r=c.distanceToSquared(e),r<l&&(l=r,o&&o.copy(e),s&&s.copy(c));let u=this[i];a.closestPointToPoint(u,e),r=u.distanceToSquared(e),r<l&&(l=r,o&&o.copy(u),s&&s.copy(e))}for(let c=0;c<3;c++){let u=n[c],d=n[(c+1)%3];r.set(this[u],this[d]);for(let c=0;c<3;c++){let u=n[c],d=n[(c+1)%3];i.set(a[u],a[d]),la(r,i,e,t);let f=e.distanceToSquared(t);f<l&&(l=f,o&&o.copy(e),s&&s.copy(t))}}return Math.sqrt(l)}})();var K=class{constructor(e,t,n){this.isOrientedBox=!0,this.min=new D,this.max=new D,this.matrix=new O,this.invMatrix=new O,this.points=Array(8).fill().map(()=>new D),this.satAxes=[,,,].fill().map(()=>new D),this.satBounds=[,,,].fill().map(()=>new sa),this.alignedSatBounds=[,,,].fill().map(()=>new sa),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),n&&this.matrix.copy(n)}set(e,t,n){this.min.copy(e),this.max.copy(t),this.matrix.copy(n),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};K.prototype.update=(function(){return function(){let e=this.matrix,t=this.min,n=this.max,r=this.points;for(let i=0;i<=1;i++)for(let a=0;a<=1;a++)for(let o=0;o<=1;o++){let s=r[1*i|2*a|4*o];s.x=i?n.x:t.x,s.y=a?n.y:t.y,s.z=o?n.z:t.z,s.applyMatrix4(e)}let i=this.satBounds,a=this.satAxes,o=r[0];for(let e=0;e<3;e++){let t=a[e],n=i[e],s=r[1<<e];t.subVectors(o,s),n.setFromPoints(t,r)}let s=this.alignedSatBounds;s[0].setFromPointsField(r,`x`),s[1].setFromPointsField(r,`y`),s[2].setFromPointsField(r,`z`),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})(),K.prototype.intersectsBox=(function(){let e=new sa;return function(t){this.needsUpdate&&this.update();let n=t.min,r=t.max,i=this.satBounds,a=this.satAxes,o=this.alignedSatBounds;if(e.min=n.x,e.max=r.x,o[0].isSeparated(e)||(e.min=n.y,e.max=r.y,o[1].isSeparated(e))||(e.min=n.z,e.max=r.z,o[2].isSeparated(e)))return!1;for(let n=0;n<3;n++){let r=a[n],o=i[n];if(e.setFromBox(r,t),o.isSeparated(e))return!1}return!0}})(),K.prototype.intersectsTriangle=(function(){let e=new ha,t=[,,,],n=new sa,r=new sa,i=new D;return function(a){this.needsUpdate&&this.update(),a.isExtendedTriangle?a.needsUpdate&&a.update():(e.copy(a),e.update(),a=e);let o=this.satBounds,s=this.satAxes;t[0]=a.a,t[1]=a.b,t[2]=a.c;for(let e=0;e<3;e++){let r=o[e],i=s[e];if(n.setFromPoints(i,t),r.isSeparated(n))return!1}let c=a.satBounds,l=a.satAxes,u=this.points;for(let e=0;e<3;e++){let t=c[e],r=l[e];if(n.setFromPoints(r,u),t.isSeparated(n))return!1}for(let e=0;e<3;e++){let a=s[e];for(let e=0;e<4;e++){let o=l[e];if(i.crossVectors(a,o),n.setFromPoints(i,t),r.setFromPoints(i,u),n.isSeparated(r))return!1}}return!0}})(),K.prototype.closestPointToPoint=(function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}})(),K.prototype.distanceToPoint=(function(){let e=new D;return function(t){return this.closestPointToPoint(t,e),t.distanceTo(e)}})(),K.prototype.distanceToBox=(function(){let e=[`x`,`y`,`z`],t=Array(12).fill().map(()=>new ne),n=Array(12).fill().map(()=>new ne),r=new D,i=new D;return function(a,o=0,s=null,c=null){if(this.needsUpdate&&this.update(),this.intersectsBox(a))return(s||c)&&(a.getCenter(i),this.closestPointToPoint(i,r),a.closestPointToPoint(r,i),s&&s.copy(r),c&&c.copy(i)),0;let l=o*o,u=a.min,d=a.max,f=this.points,p=1/0;for(let e=0;e<8;e++){let t=f[e];i.copy(t).clamp(u,d);let n=t.distanceToSquared(i);if(n<p&&(p=n,s&&s.copy(t),c&&c.copy(i),n<l))return Math.sqrt(n)}let m=0;for(let r=0;r<3;r++)for(let i=0;i<=1;i++)for(let a=0;a<=1;a++){let o=(r+1)%3,s=(r+2)%3,c=i<<o|a<<s,l=1<<r|i<<o|a<<s,p=f[c],h=f[l];t[m].set(p,h);let g=e[r],_=e[o],v=e[s],y=n[m],b=y.start,x=y.end;b[g]=u[g],b[_]=i?u[_]:d[_],b[v]=a?u[v]:d[_],x[g]=d[g],x[_]=i?u[_]:d[_],x[v]=a?u[v]:d[_],m++}for(let e=0;e<=1;e++)for(let t=0;t<=1;t++)for(let n=0;n<=1;n++){i.x=e?d.x:u.x,i.y=t?d.y:u.y,i.z=n?d.z:u.z,this.closestPointToPoint(i,r);let a=i.distanceToSquared(r);if(a<p&&(p=a,s&&s.copy(r),c&&c.copy(i),a<l))return Math.sqrt(a)}for(let e=0;e<12;e++){let a=t[e];for(let e=0;e<12;e++){let t=n[e];la(a,t,r,i);let o=r.distanceToSquared(i);if(o<p&&(p=o,s&&s.copy(r),c&&c.copy(i),o<l))return Math.sqrt(o)}}return Math.sqrt(p)}})();var ga=new class extends Ai{constructor(){super(()=>new ha)}},_a=new D,va=new D;function ya(e,t,n={},r=0,i=1/0){let a=r*r,o=i*i,s=1/0,c=null;if(e.shapecast({boundsTraverseOrder:e=>(_a.copy(t).clamp(e.min,e.max),_a.distanceToSquared(t)),intersectsBounds:(e,t,n)=>n<s&&n<o,intersectsTriangle:(e,n)=>{e.closestPointToPoint(t,_a);let r=t.distanceToSquared(_a);return r<s&&(va.copy(_a),s=r,c=n),r<a}}),s===1/0)return null;let l=Math.sqrt(s);return n.point?n.point.copy(va):n.point=va.clone(),n.distance=l,n.faceIndex=c,n}var ba=!0,xa=new D,Sa=new D,Ca=new D,wa=new le,Ta=new le,Ea=new le,Da=new D,Oa=new D,ka=new D,Aa=new D;function ja(e,t,n,r,i,a,o,s){let c;if(c=a===1?e.intersectTriangle(r,n,t,!0,i):e.intersectTriangle(t,n,r,a!==2,i),c===null)return null;let l=e.origin.distanceTo(i);return l<o||l>s?null:{distance:l,point:i.clone()}}function Ma(e,t,n,r,i,a,o,s,c,l,u){xa.fromBufferAttribute(t,a),Sa.fromBufferAttribute(t,o),Ca.fromBufferAttribute(t,s);let d=ja(e,xa,Sa,Ca,Aa,c,l,u);if(d){if(r){wa.fromBufferAttribute(r,a),Ta.fromBufferAttribute(r,o),Ea.fromBufferAttribute(r,s),d.uv=new le;let e=b.getInterpolation(Aa,xa,Sa,Ca,wa,Ta,Ea,d.uv);ba||(d.uv=e)}if(i){wa.fromBufferAttribute(i,a),Ta.fromBufferAttribute(i,o),Ea.fromBufferAttribute(i,s),d.uv1=new le;let e=b.getInterpolation(Aa,xa,Sa,Ca,wa,Ta,Ea,d.uv1);ba||(d.uv1=e)}if(n){Da.fromBufferAttribute(n,a),Oa.fromBufferAttribute(n,o),ka.fromBufferAttribute(n,s),d.normal=new D;let t=b.getInterpolation(Aa,xa,Sa,Ca,Da,Oa,ka,d.normal);d.normal.dot(e.direction)>0&&d.normal.multiplyScalar(-1),ba||(d.normal=t)}let t={a,b:o,c:s,normal:new D,materialIndex:0};if(b.getNormal(xa,Sa,Ca,t.normal),d.face=t,d.faceIndex=a,ba){let e=new D;b.getBarycoord(Aa,xa,Sa,Ca,e),d.barycoord=e}}return d}function Na(e){return e&&e.isMaterial?e.side:e}function Pa(e,t,n,r,i,a,o){let s=r*3,c=s+0,l=s+1,u=s+2,{index:d,groups:f}=e;e.index&&(c=d.getX(c),l=d.getX(l),u=d.getX(u));let{position:p,normal:m,uv:h,uv1:g}=e.attributes;if(Array.isArray(t)){let e=r*3;for(let s=0,d=f.length;s<d;s++){let{start:d,count:_,materialIndex:v}=f[s];if(e>=d&&e<d+_){let e=Na(t[v]),s=Ma(n,p,m,h,g,c,l,u,e,a,o);if(s)if(s.faceIndex=r,s.face.materialIndex=v,i)i.push(s);else return s}}}else{let e=Na(t),s=Ma(n,p,m,h,g,c,l,u,e,a,o);if(s)if(s.faceIndex=r,s.face.materialIndex=0,i)i.push(s);else return s}return null}function q(e,t,n,r){let i=e.a,a=e.b,o=e.c,s=t,c=t+1,l=t+2;n&&(s=n.getX(s),c=n.getX(c),l=n.getX(l)),i.x=r.getX(s),i.y=r.getY(s),i.z=r.getZ(s),a.x=r.getX(c),a.y=r.getY(c),a.z=r.getZ(c),o.x=r.getX(l),o.y=r.getY(l),o.z=r.getZ(l)}function Fa(e,t,n,r,i,a,o,s){let{geometry:c,_indirectBuffer:l}=e;for(let e=r,l=r+i;e<l;e++)Pa(c,t,n,e,a,o,s)}function Ia(e,t,n,r,i,a,o){let{geometry:s,_indirectBuffer:c}=e,l=1/0,u=null;for(let e=r,c=r+i;e<c;e++){let r;r=Pa(s,t,n,e,null,a,o),r&&r.distance<l&&(u=r,l=r.distance)}return u}function La(e,t,n,r,i,a,o){let{geometry:s}=n,{index:c}=s,l=s.attributes.position;for(let n=e,s=t+e;n<s;n++){let e;if(e=n,q(o,e*3,c,l),o.needsUpdate=!0,r(o,e,i,a))return!0}return!1}function Ra(e,t=null){t&&Array.isArray(t)&&(t=new Set(t));let n=e.geometry,r=n.index?n.index.array:null,i=n.attributes.position,a,o,s,c,l=0,u=e._roots;for(let e=0,t=u.length;e<t;e++)a=u[e],o=new Uint32Array(a),s=new Uint16Array(a),c=new Float32Array(a),d(0,l),l+=a.byteLength;function d(e,n,a=!1){let l=e*2;if(z(l,s)){let t=B(e,o),n=V(l,s),a=1/0,u=1/0,d=1/0,f=-1/0,p=-1/0,m=-1/0;for(let e=3*t,o=3*(t+n);e<o;e++){let t=r[e],n=i.getX(t),o=i.getY(t),s=i.getZ(t);n<a&&(a=n),n>f&&(f=n),o<u&&(u=o),o>p&&(p=o),s<d&&(d=s),s>m&&(m=s)}return c[e+0]!==a||c[e+1]!==u||c[e+2]!==d||c[e+3]!==f||c[e+4]!==p||c[e+5]!==m?(c[e+0]=a,c[e+1]=u,c[e+2]=d,c[e+3]=f,c[e+4]=p,c[e+5]=m,!0):!1}else{let r=H(e),i=U(e,o),s=a,l=!1,u=!1;if(t){if(!s){let e=r/8+n/32,a=i/8+n/32;l=t.has(e),u=t.has(a),s=!l&&!u}}else l=!0,u=!0;let f=s||l,p=s||u,m=!1;f&&(m=d(r,n,s));let h=!1;p&&(h=d(i,n,s));let g=m||h;if(g)for(let t=0;t<3;t++){let n=r+t,a=i+t,o=c[n],s=c[n+3],l=c[a],u=c[a+3];c[e+t]=o<l?o:l,c[e+t+3]=s>u?s:u}return g}}}function za(e,t,n,r,i){let a,o,s,c,l,u,d=1/n.direction.x,f=1/n.direction.y,p=1/n.direction.z,m=n.origin.x,h=n.origin.y,g=n.origin.z,_=t[e],v=t[e+3],y=t[e+1],b=t[e+3+1],x=t[e+2],S=t[e+3+2];return d>=0?(a=(_-m)*d,o=(v-m)*d):(a=(v-m)*d,o=(_-m)*d),f>=0?(s=(y-h)*f,c=(b-h)*f):(s=(b-h)*f,c=(y-h)*f),a>c||s>o||((s>a||isNaN(a))&&(a=s),(c<o||isNaN(o))&&(o=c),p>=0?(l=(x-g)*p,u=(S-g)*p):(l=(S-g)*p,u=(x-g)*p),a>u||l>o)?!1:((l>a||a!==a)&&(a=l),(u<o||o!==o)&&(o=u),a<=i&&o>=r)}function Ba(e,t,n,r,i,a,o,s){let{geometry:c,_indirectBuffer:l}=e;for(let e=r,u=r+i;e<u;e++)Pa(c,t,n,l?l[e]:e,a,o,s)}function Va(e,t,n,r,i,a,o){let{geometry:s,_indirectBuffer:c}=e,l=1/0,u=null;for(let e=r,d=r+i;e<d;e++){let r;r=Pa(s,t,n,c?c[e]:e,null,a,o),r&&r.distance<l&&(u=r,l=r.distance)}return u}function Ha(e,t,n,r,i,a,o){let{geometry:s}=n,{index:c}=s,l=s.attributes.position;for(let s=e,u=t+e;s<u;s++){let e;if(e=n.resolveTriangleIndex(s),q(o,e*3,c,l),o.needsUpdate=!0,r(o,e,i,a))return!0}return!1}function Ua(e,t,n,r,i,a,o){G.setBuffer(e._roots[t]),Wa(0,e,n,r,i,a,o),G.clearBuffer()}function Wa(e,t,n,r,i,a,o){let{float32Array:s,uint16Array:c,uint32Array:l}=G,u=e*2;if(z(u,c))Fa(t,n,r,B(e,l),V(u,c),i,a,o);else{let c=H(e);za(c,s,r,a,o)&&Wa(c,t,n,r,i,a,o);let u=U(e,l);za(u,s,r,a,o)&&Wa(u,t,n,r,i,a,o)}}var Ga=[`x`,`y`,`z`];function Ka(e,t,n,r,i,a){G.setBuffer(e._roots[t]);let o=qa(0,e,n,r,i,a);return G.clearBuffer(),o}function qa(e,t,n,r,i,a){let{float32Array:o,uint16Array:s,uint32Array:c}=G,l=e*2;if(z(l,s))return Ia(t,n,r,B(e,c),V(l,s),i,a);{let s=ui(e,c),l=Ga[s],u=r.direction[l]>=0,d,f;u?(d=H(e),f=U(e,c)):(d=U(e,c),f=H(e));let p=za(d,o,r,i,a)?qa(d,t,n,r,i,a):null;if(p){let e=p.point[l];if(u?e<=o[f+s]:e>=o[f+s+3])return p}let m=za(f,o,r,i,a)?qa(f,t,n,r,i,a):null;return p&&m?p.distance<=m.distance?p:m:p||m||null}}var Ja=new E,Ya=new ha,Xa=new ha,Za=new O,Qa=new K,$a=new K;function eo(e,t,n,r){G.setBuffer(e._roots[t]);let i=to(0,e,n,r);return G.clearBuffer(),i}function to(e,t,n,r,i=null){let{float32Array:a,uint16Array:o,uint32Array:s}=G,c=e*2;if(i===null&&(n.boundingBox||n.computeBoundingBox(),Qa.set(n.boundingBox.min,n.boundingBox.max,r),i=Qa),z(c,o)){let i=t.geometry,l=i.index,u=i.attributes.position,d=n.index,f=n.attributes.position,p=B(e,s),m=V(c,o);if(Za.copy(r).invert(),n.boundsTree)return R(W(e),a,$a),$a.matrix.copy(Za),$a.needsUpdate=!0,n.boundsTree.shapecast({intersectsBounds:e=>$a.intersectsBox(e),intersectsTriangle:e=>{e.a.applyMatrix4(r),e.b.applyMatrix4(r),e.c.applyMatrix4(r),e.needsUpdate=!0;for(let t=p*3,n=(m+p)*3;t<n;t+=3)if(q(Xa,t,l,u),Xa.needsUpdate=!0,e.intersectsTriangle(Xa))return!0;return!1}});{let e=$i(n);for(let t=p*3,n=(m+p)*3;t<n;t+=3){q(Ya,t,l,u),Ya.a.applyMatrix4(Za),Ya.b.applyMatrix4(Za),Ya.c.applyMatrix4(Za),Ya.needsUpdate=!0;for(let t=0,n=e*3;t<n;t+=3)if(q(Xa,t,d,f),Xa.needsUpdate=!0,Ya.intersectsTriangle(Xa))return!0}}}else{let o=H(e),c=U(e,s);return R(W(o),a,Ja),!!(i.intersectsBox(Ja)&&to(o,t,n,r,i)||(R(W(c),a,Ja),i.intersectsBox(Ja)&&to(c,t,n,r,i)))}}var no=new O,ro=new K,io=new K,ao=new D,oo=new D,so=new D,co=new D;function lo(e,t,n,r={},i={},a=0,o=1/0){t.boundingBox||t.computeBoundingBox(),ro.set(t.boundingBox.min,t.boundingBox.max,n),ro.needsUpdate=!0;let s=e.geometry,c=s.attributes.position,l=s.index,u=t.attributes.position,d=t.index,f=ga.getPrimitive(),p=ga.getPrimitive(),m=ao,h=oo,g=null,_=null;i&&(g=so,_=co);let v=1/0,y=null,b=null;return no.copy(n).invert(),io.matrix.copy(no),e.shapecast({boundsTraverseOrder:e=>ro.distanceToBox(e),intersectsBounds:(e,t,n)=>n<v&&n<o?(t&&(io.min.copy(e.min),io.max.copy(e.max),io.needsUpdate=!0),!0):!1,intersectsRange:(e,r)=>{if(t.boundsTree)return t.boundsTree.shapecast({boundsTraverseOrder:e=>io.distanceToBox(e),intersectsBounds:(e,t,n)=>n<v&&n<o,intersectsRange:(t,i)=>{for(let o=t,s=t+i;o<s;o++){q(p,3*o,d,u),p.a.applyMatrix4(n),p.b.applyMatrix4(n),p.c.applyMatrix4(n),p.needsUpdate=!0;for(let t=e,n=e+r;t<n;t++){q(f,3*t,l,c),f.needsUpdate=!0;let e=f.distanceToTriangle(p,m,g);if(e<v&&(h.copy(m),_&&_.copy(g),v=e,y=t,b=o),e<a)return!0}}}});{let i=$i(t);for(let t=0,o=i;t<o;t++){q(p,3*t,d,u),p.a.applyMatrix4(n),p.b.applyMatrix4(n),p.c.applyMatrix4(n),p.needsUpdate=!0;for(let n=e,i=e+r;n<i;n++){q(f,3*n,l,c),f.needsUpdate=!0;let e=f.distanceToTriangle(p,m,g);if(e<v&&(h.copy(m),_&&_.copy(g),v=e,y=n,b=t),e<a)return!0}}}}}),ga.releasePrimitive(f),ga.releasePrimitive(p),v===1/0?null:(r.point?r.point.copy(h):r.point=h.clone(),r.distance=v,r.faceIndex=y,i&&(i.point?i.point.copy(_):i.point=_.clone(),i.point.applyMatrix4(no),h.applyMatrix4(no),i.distance=h.sub(i.point).length(),i.faceIndex=b),r)}function uo(e,t=null){t&&Array.isArray(t)&&(t=new Set(t));let n=e.geometry,r=n.index?n.index.array:null,i=n.attributes.position,a,o,s,c,l=0,u=e._roots;for(let e=0,t=u.length;e<t;e++)a=u[e],o=new Uint32Array(a),s=new Uint16Array(a),c=new Float32Array(a),d(0,l),l+=a.byteLength;function d(n,a,l=!1){let u=n*2;if(z(u,s)){let t=B(n,o),a=V(u,s),l=1/0,d=1/0,f=1/0,p=-1/0,m=-1/0,h=-1/0;for(let n=t,o=t+a;n<o;n++){let t=3*e.resolveTriangleIndex(n);for(let e=0;e<3;e++){let n=t+e;n=r?r[n]:n;let a=i.getX(n),o=i.getY(n),s=i.getZ(n);a<l&&(l=a),a>p&&(p=a),o<d&&(d=o),o>m&&(m=o),s<f&&(f=s),s>h&&(h=s)}}return c[n+0]!==l||c[n+1]!==d||c[n+2]!==f||c[n+3]!==p||c[n+4]!==m||c[n+5]!==h?(c[n+0]=l,c[n+1]=d,c[n+2]=f,c[n+3]=p,c[n+4]=m,c[n+5]=h,!0):!1}else{let e=H(n),r=U(n,o),i=l,s=!1,u=!1;if(t){if(!i){let n=e/8+a/32,o=r/8+a/32;s=t.has(n),u=t.has(o),i=!s&&!u}}else s=!0,u=!0;let f=i||s,p=i||u,m=!1;f&&(m=d(e,a,i));let h=!1;p&&(h=d(r,a,i));let g=m||h;if(g)for(let t=0;t<3;t++){let i=e+t,a=r+t,o=c[i],s=c[i+3],l=c[a],u=c[a+3];c[n+t]=o<l?o:l,c[n+t+3]=s>u?s:u}return g}}}function fo(e,t,n,r,i,a,o){G.setBuffer(e._roots[t]),po(0,e,n,r,i,a,o),G.clearBuffer()}function po(e,t,n,r,i,a,o){let{float32Array:s,uint16Array:c,uint32Array:l}=G,u=e*2;if(z(u,c))Ba(t,n,r,B(e,l),V(u,c),i,a,o);else{let c=H(e);za(c,s,r,a,o)&&po(c,t,n,r,i,a,o);let u=U(e,l);za(u,s,r,a,o)&&po(u,t,n,r,i,a,o)}}var mo=[`x`,`y`,`z`];function ho(e,t,n,r,i,a){G.setBuffer(e._roots[t]);let o=go(0,e,n,r,i,a);return G.clearBuffer(),o}function go(e,t,n,r,i,a){let{float32Array:o,uint16Array:s,uint32Array:c}=G,l=e*2;if(z(l,s))return Va(t,n,r,B(e,c),V(l,s),i,a);{let s=ui(e,c),l=mo[s],u=r.direction[l]>=0,d,f;u?(d=H(e),f=U(e,c)):(d=U(e,c),f=H(e));let p=za(d,o,r,i,a)?go(d,t,n,r,i,a):null;if(p){let e=p.point[l];if(u?e<=o[f+s]:e>=o[f+s+3])return p}let m=za(f,o,r,i,a)?go(f,t,n,r,i,a):null;return p&&m?p.distance<=m.distance?p:m:p||m||null}}var _o=new E,vo=new ha,yo=new ha,bo=new O,xo=new K,So=new K;function Co(e,t,n,r){G.setBuffer(e._roots[t]);let i=wo(0,e,n,r);return G.clearBuffer(),i}function wo(e,t,n,r,i=null){let{float32Array:a,uint16Array:o,uint32Array:s}=G,c=e*2;if(i===null&&(n.boundingBox||n.computeBoundingBox(),xo.set(n.boundingBox.min,n.boundingBox.max,r),i=xo),z(c,o)){let i=t.geometry,l=i.index,u=i.attributes.position,d=n.index,f=n.attributes.position,p=B(e,s),m=V(c,o);if(bo.copy(r).invert(),n.boundsTree)return R(W(e),a,So),So.matrix.copy(bo),So.needsUpdate=!0,n.boundsTree.shapecast({intersectsBounds:e=>So.intersectsBox(e),intersectsTriangle:e=>{e.a.applyMatrix4(r),e.b.applyMatrix4(r),e.c.applyMatrix4(r),e.needsUpdate=!0;for(let n=p,r=m+p;n<r;n++)if(q(yo,3*t.resolveTriangleIndex(n),l,u),yo.needsUpdate=!0,e.intersectsTriangle(yo))return!0;return!1}});{let e=$i(n);for(let n=p,r=m+p;n<r;n++){q(vo,3*t.resolveTriangleIndex(n),l,u),vo.a.applyMatrix4(bo),vo.b.applyMatrix4(bo),vo.c.applyMatrix4(bo),vo.needsUpdate=!0;for(let t=0,n=e*3;t<n;t+=3)if(q(yo,t,d,f),yo.needsUpdate=!0,vo.intersectsTriangle(yo))return!0}}}else{let o=H(e),c=U(e,s);return R(W(o),a,_o),!!(i.intersectsBox(_o)&&wo(o,t,n,r,i)||(R(W(c),a,_o),i.intersectsBox(_o)&&wo(c,t,n,r,i)))}}var To=new O,Eo=new K,Do=new K,Oo=new D,ko=new D,Ao=new D,jo=new D;function Mo(e,t,n,r={},i={},a=0,o=1/0){t.boundingBox||t.computeBoundingBox(),Eo.set(t.boundingBox.min,t.boundingBox.max,n),Eo.needsUpdate=!0;let s=e.geometry,c=s.attributes.position,l=s.index,u=t.attributes.position,d=t.index,f=ga.getPrimitive(),p=ga.getPrimitive(),m=Oo,h=ko,g=null,_=null;i&&(g=Ao,_=jo);let v=1/0,y=null,b=null;return To.copy(n).invert(),Do.matrix.copy(To),e.shapecast({boundsTraverseOrder:e=>Eo.distanceToBox(e),intersectsBounds:(e,t,n)=>n<v&&n<o?(t&&(Do.min.copy(e.min),Do.max.copy(e.max),Do.needsUpdate=!0),!0):!1,intersectsRange:(r,i)=>{if(t.boundsTree){let s=t.boundsTree;return s.shapecast({boundsTraverseOrder:e=>Do.distanceToBox(e),intersectsBounds:(e,t,n)=>n<v&&n<o,intersectsRange:(t,o)=>{for(let x=t,S=t+o;x<S;x++){let t=s.resolveTriangleIndex(x);q(p,3*t,d,u),p.a.applyMatrix4(n),p.b.applyMatrix4(n),p.c.applyMatrix4(n),p.needsUpdate=!0;for(let t=r,n=r+i;t<n;t++){let n=e.resolveTriangleIndex(t);q(f,3*n,l,c),f.needsUpdate=!0;let r=f.distanceToTriangle(p,m,g);if(r<v&&(h.copy(m),_&&_.copy(g),v=r,y=t,b=x),r<a)return!0}}}})}else{let o=$i(t);for(let t=0,s=o;t<s;t++){q(p,3*t,d,u),p.a.applyMatrix4(n),p.b.applyMatrix4(n),p.c.applyMatrix4(n),p.needsUpdate=!0;for(let n=r,o=r+i;n<o;n++){let r=e.resolveTriangleIndex(n);q(f,3*r,l,c),f.needsUpdate=!0;let i=f.distanceToTriangle(p,m,g);if(i<v&&(h.copy(m),_&&_.copy(g),v=i,y=n,b=t),i<a)return!0}}}}}),ga.releasePrimitive(f),ga.releasePrimitive(p),v===1/0?null:(r.point?r.point.copy(h):r.point=h.clone(),r.distance=v,r.faceIndex=y,i&&(i.point?i.point.copy(_):i.point=_.clone(),i.point.applyMatrix4(To),h.applyMatrix4(To),i.distance=h.sub(i.point).length(),i.faceIndex=b),r)}function No(e,t,n){return e===null?null:(e.point.applyMatrix4(t.matrixWorld),e.distance=e.point.distanceTo(n.ray.origin),e.object=t,e)}var Po=new K,Fo=new ve,Io=new D,Lo=new O,Ro=new D,zo=[`getX`,`getY`,`getZ`],Bo=class e extends oa{static serialize(e,t={}){t={cloneBuffers:!0,...t};let n=e.geometry,r=e._roots,i=e._indirectBuffer,a=n.getIndex(),o={version:1,roots:null,index:null,indirectBuffer:null};return t.cloneBuffers?(o.roots=r.map(e=>e.slice()),o.index=a?a.array.slice():null,o.indirectBuffer=i?i.slice():null):(o.roots=r,o.index=a?a.array:null,o.indirectBuffer=i),o}static deserialize(t,n,r={}){r={setIndex:!0,indirect:!!t.indirectBuffer,...r};let{index:i,roots:a,indirectBuffer:o}=t;t.version||(console.warn(`MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data.`),c(a));let s=new e(n,{...r,[ri]:!0});if(s._roots=a,s._indirectBuffer=o||null,r.setIndex){let e=n.getIndex();if(e===null){let e=new C(t.index,1,!1);n.setIndex(e)}else e.array!==i&&(e.array.set(i),e.needsUpdate=!0)}return s;function c(e){for(let t=0;t<e.length;t++){let n=e[t],r=new Uint32Array(n),i=new Uint16Array(n);for(let e=0,t=n.byteLength/32;e<t;e++){let t=8*e;z(2*t,i)||(r[t+6]=r[t+6]/8-e)}}}}get primitiveStride(){return 3}get resolveTriangleIndex(){return this.resolvePrimitiveIndex}constructor(e,t={}){t.maxLeafTris&&(console.warn(`MeshBVH: "maxLeafTris" option has been deprecated. Use "targetLeafSize", instead.`),t={...t,targetLeafSize:t.maxLeafTris}),super(e,t)}shiftTriangleOffsets(e){return super.shiftPrimitiveOffsets(e)}writePrimitiveBounds(e,t,n){let r=this.geometry,i=this._indirectBuffer,a=r.attributes.position,o=r.index?r.index.array:null,s=(i?i[e]:e)*3,c=s+0,l=s+1,u=s+2;o&&(c=o[c],l=o[l],u=o[u]);for(let e=0;e<3;e++){let r=a[zo[e]](c),i=a[zo[e]](l),o=a[zo[e]](u),s=r;i<s&&(s=i),o<s&&(s=o);let d=r;i>d&&(d=i),o>d&&(d=o),t[n+e]=s,t[n+e+3]=d}return t}computePrimitiveBounds(e,t,n){let r=this.geometry,i=this._indirectBuffer,a=r.attributes.position,o=r.index?r.index.array:null,s=a.normalized;if(e<0||t+e-n.offset>n.length/6)throw Error(`MeshBVH: compute triangle bounds range is invalid.`);let c=a.array,l=a.offset||0,u=3;a.isInterleavedBufferAttribute&&(u=a.data.stride);let d=[`getX`,`getY`,`getZ`],f=n.offset;for(let r=e,p=e+t;r<p;r++){let e=(i?i[r]:r)*3,t=(r-f)*6,p=e+0,m=e+1,h=e+2;o&&(p=o[p],m=o[m],h=o[h]),s||(p=p*u+l,m=m*u+l,h=h*u+l);for(let e=0;e<3;e++){let r,i,o;s?(r=a[d[e]](p),i=a[d[e]](m),o=a[d[e]](h)):(r=c[p+e],i=c[m+e],o=c[h+e]);let l=r;i<l&&(l=i),o<l&&(l=o);let u=r;i>u&&(u=i),o>u&&(u=o);let f=(u-l)/2,g=e*2;n[t+g+0]=l+f,n[t+g+1]=f+(Math.abs(l)+f)*ni}}return n}raycastObject3D(e,t,n=[]){let{material:r}=e;if(r===void 0)return;Lo.copy(e.matrixWorld).invert(),Fo.copy(t.ray).applyMatrix4(Lo),Ro.setFromMatrixScale(e.matrixWorld),Io.copy(Fo.direction).multiply(Ro);let i=Io.length(),a=t.near/i,o=t.far/i;if(t.firstHitOnly===!0){let i=this.raycastFirst(Fo,r,a,o);i=No(i,e,t),i&&n.push(i)}else{let i=this.raycast(Fo,r,a,o);for(let r=0,a=i.length;r<a;r++){let a=No(i[r],e,t);a&&n.push(a)}}return n}refit(e=null){return(this.indirect?uo:Ra)(this,e)}raycast(e,t=0,n=0,r=1/0){let i=this._roots,a=[],o=this.indirect?fo:Ua;for(let s=0,c=i.length;s<c;s++)o(this,s,t,e,a,n,r);return a}raycastFirst(e,t=0,n=0,r=1/0){let i=this._roots,a=null,o=this.indirect?ho:Ka;for(let s=0,c=i.length;s<c;s++){let i=o(this,s,t,e,n,r);i!=null&&(a==null||i.distance<a.distance)&&(a=i)}return a}intersectsGeometry(e,t){let n=!1,r=this._roots,i=this.indirect?Co:eo;for(let a=0,o=r.length;a<o&&(n=i(this,a,e,t),!n);a++);return n}shapecast(e){let t=ga.getPrimitive(),n=super.shapecast({...e,intersectsPrimitive:e.intersectsTriangle,scratchPrimitive:t,iterate:this.indirect?Ha:La});return ga.releasePrimitive(t),n}bvhcast(t,n,r){let{intersectsRanges:i,intersectsTriangles:a}=r,o=ga.getPrimitive(),s=this.geometry.index,c=this.geometry.attributes.position,l=this.indirect?e=>{let t=this.resolveTriangleIndex(e);q(o,t*3,s,c)}:e=>{q(o,e*3,s,c)},u=ga.getPrimitive(),d=t.geometry.index,f=t.geometry.attributes.position,p=t.indirect?e=>{let n=t.resolveTriangleIndex(e);q(u,n*3,d,f)}:e=>{q(u,e*3,d,f)};if(a){if(!(t instanceof e))throw Error(`MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.`);let r=(e,t,r,i,s,c,d,f)=>{for(let m=r,h=r+i;m<h;m++){p(m),u.a.applyMatrix4(n),u.b.applyMatrix4(n),u.c.applyMatrix4(n),u.needsUpdate=!0;for(let n=e,r=e+t;n<r;n++)if(l(n),o.needsUpdate=!0,a(o,u,n,m,s,c,d,f))return!0}return!1};if(i){let e=i;i=function(t,n,i,a,o,s,c,l){return e(t,n,i,a,o,s,c,l)?!0:r(t,n,i,a,o,s,c,l)}}else i=r}return super.bvhcast(t,n,{intersectsRanges:i})}intersectsBox(e,t){return Po.set(e.min,e.max,t),Po.needsUpdate=!0,this.shapecast({intersectsBounds:e=>Po.intersectsBox(e),intersectsTriangle:e=>Po.intersectsTriangle(e)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,n={},r={},i=0,a=1/0){return(this.indirect?Mo:lo)(this,e,t,n,r,i,a)}closestPointToPoint(e,t={},n=0,r=1/0){return ya(this,e,t,n,r)}},Vo=new O,Ho=new ve,Uo=new Ai(()=>new D),Wo=new E,Go=new D,Ko=class extends oa{get primitiveStride(){return 1}writePrimitiveBounds(e,t,n){let r=this._indirectBuffer,{geometry:i}=this,a=i.attributes.position,o=i.index,s=r?r[e]:e;o&&(s=o.getX(s));let c=a.getX(s),l=a.getY(s),u=a.getZ(s);return t[n+0]=c,t[n+1]=l,t[n+2]=u,t[n+3]=c,t[n+4]=l,t[n+5]=u,t}shapecast(e){let t=Uo.getPrimitive(),n=super.shapecast({...e,intersectsPrimitive:e.intersectsPoint,scratchPrimitive:t,iterate:qo});return Uo.releasePrimitive(t),n}raycastObject3D(e,t,n=[]){let{geometry:r}=this,{matrixWorld:i}=e,{firstHitOnly:a}=t;Vo.copy(i).invert(),Ho.copy(t.ray).applyMatrix4(Vo);let o=t.params.Points.threshold/((e.scale.x+e.scale.y+e.scale.z)/3),s=o*o,c=null,l=1/0;return this.shapecast({boundsTraverseOrder:e=>e.distanceToPoint(Ho.origin),intersectsBounds:e=>{if(Wo.copy(e).expandByScalar(o),a){if(!Ho.intersectBox(Wo,Go))return 0;let e;return Wo.containsPoint(Ho.origin)?e=0:(Go.applyMatrix4(i),e=t.ray.origin.distanceTo(Go)),+(e<l)}else return+!!Ho.intersectsBox(Wo)},intersectsPoint:(o,u)=>{let d=Ho.distanceSqToPoint(o);if(d<s){let s=new D;Ho.closestPointToPoint(o,s),s.applyMatrix4(i);let f=t.ray.origin.distanceTo(s);if(f<t.near||f>t.far||a&&f>=l)return;l=f,u=this.resolvePrimitiveIndex(u),c={distance:f,distanceToRay:Math.sqrt(d),point:s,index:r.index?r.index.getX(u):u,face:null,faceIndex:null,barycoord:null,object:e},a||n.push(c)}}}),a&&c&&n.push(c),n}};function qo(e,t,n,r,i,a,o){let{geometry:s}=n,{index:c}=s,l=s.attributes.position;for(let s=e,u=t+e;s<u;s++){let e=n.resolvePrimitiveIndex(s),t=c?c.array[e]:e;if(o.fromBufferAttribute(l,t),r(o,s,i,a))return!0}return!1}var Jo=!0,Yo={Mesh:ue.prototype.raycast,Line:ee.prototype.raycast,LineSegments:g.prototype.raycast,LineLoop:ye.prototype.raycast,Points:ie.prototype.raycast,BatchedMesh:_e.prototype.raycast},J=new ue,Xo=[];function Zo(e,t){if(this.isBatchedMesh)Qo.call(this,e,t);else{let{geometry:n}=this;if(n.boundsTree)n.boundsTree.raycastObject3D(this,e,t);else{let n;if(this instanceof ue)n=Yo.Mesh;else if(this instanceof g)n=Yo.LineSegments;else if(this instanceof ye)n=Yo.LineLoop;else if(this instanceof ee)n=Yo.Line;else if(this instanceof ie)n=Yo.Points;else throw Error(`BVH: Fallback raycast function not found.`);n.call(this,e,t)}}}function Qo(e,t){if(this.boundsTrees){let n=this.boundsTrees,r=this._drawInfo||this._instanceInfo,i=this._drawRanges||this._geometryInfo,a=this.matrixWorld;J.material=this.material,J.geometry=this.geometry;let o=J.geometry.boundsTree,s=J.geometry.drawRange;J.geometry.boundingSphere===null&&(J.geometry.boundingSphere=new pe);for(let o=0,s=r.length;o<s;o++){if(!this.getVisibleAt(o))continue;let s=r[o].geometryIndex;if(J.geometry.boundsTree=n[s],this.getMatrixAt(o,J.matrixWorld).premultiply(a),!J.geometry.boundsTree){this.getBoundingBoxAt(s,J.geometry.boundingBox),this.getBoundingSphereAt(s,J.geometry.boundingSphere);let e=i[s];J.geometry.setDrawRange(e.start,e.count)}J.raycast(e,Xo);for(let e=0,n=Xo.length;e<n;e++){let n=Xo[e];n.object=this,n.batchId=o,t.push(n)}Xo.length=0}J.geometry.boundsTree=o,J.geometry.drawRange=s,J.material=null,J.geometry=null}else Yo.BatchedMesh.call(this,e,t)}function $o(e={}){let{type:t=Bo}=e;return this.boundsTree=new t(this,e),this.boundsTree}function es(){this.boundsTree=null}function ts(e=-1,t={}){if(!Jo)throw Error(`BatchedMesh: Three r166+ is required to compute bounds trees.`);t={...t,range:null};let n=this._drawRanges||this._geometryInfo,r=this._geometryCount;this.boundsTrees||=Array(r).fill(null);let i=this.boundsTrees;for(;i.length<r;)i.push(null);if(e<0){for(let e=0;e<r;e++)t.range=n[e],i[e]=new Bo(this.geometry,t);return i}else return e<n.length&&(t.range=n[e],i[e]=new Bo(this.geometry,t)),i[e]||null}function ns(e=-1){e<0?this.boundsTrees.fill(null):e<this.boundsTrees.length&&(this.boundsTrees[e]=null)}var rs={strategy:0,indirect:!0,maxDepth:40,targetLeafSize:20},is=(e,t)=>{let n=new Ko(e,{...rs,[ri]:!0}),r=n;r._roots=t.roots,r._indirectBuffer=t.indirectBuffer,e.boundsTree=n};function as(e,t){let n=[],{firstHitOnly:r}=e;e.firstHitOnly=!1,Zo.call(this,e,n),e.firstHitOnly=r;let i=os(n);i&&t.push(i)}var os=e=>{let t;for(let n of e)(t===void 0||n.distanceToRay<t.distanceToRay||n.distanceToRay===t.distanceToRay&&n.distance<t.distance)&&(t=n);return t},ss=(e,t,n)=>{e.has(t)?e.set(t,n):e.add(t(n))},cs=e({AppliedAppearance:()=>lc,Arrow:()=>Ps,Arrows:()=>Rs,Box:()=>Y,BufferGeometry:()=>$,Camera:()=>sc,Capsule:()=>X,Center:()=>fs,ChunkProgress:()=>_c,ColliderHidden:()=>Ss,Color:()=>js,Colors:()=>Is,ComplexObstacleShape:()=>qs,ConfigOnlyFrame:()=>Ws,CustomDetails:()=>bs,Cylinder:()=>Q,DepthTest:()=>Ns,DotColors:()=>mc,DotSize:()=>hc,DrawAPI:()=>Js,DroppedFile:()=>$s,Editable:()=>ac,EditedMatrix:()=>ms,Folder:()=>nc,FramelessComponent:()=>ec,FramesAPI:()=>Hs,GLTF:()=>Vs,Geometry:()=>Sc,GhostModelKey:()=>ws,Hovered:()=>vs,ISSUE_SEVERITIES:()=>rc,InheritedInvisible:()=>xs,Instance:()=>Es,InstanceId:()=>Ts,InstancedMatrix:()=>_s,Instances:()=>Ds,Invisible:()=>ys,Issues:()=>ic,Kind:()=>Us,KinematicLink:()=>Gs,Kinematics:()=>cc,LinePositions:()=>fc,LineWidth:()=>pc,LiveMatrix:()=>hs,Material:()=>Ms,Matrix:()=>ps,Model:()=>Cs,Name:()=>ls,NonSelectable:()=>yc,ObstacleShape:()=>Ks,Opacities:()=>Ls,Opacity:()=>ks,OpacityOverride:()=>As,Orphan:()=>ds,PointCloudAPI:()=>Zs,PointCloudObjectAPI:()=>Qs,PointSampling:()=>Bs,PointSize:()=>dc,Points:()=>zs,Positions:()=>Fs,ReferenceFrame:()=>gc,Removable:()=>xc,RenderOrder:()=>Os,SavedPose:()=>tc,ScreenSpace:()=>uc,SelectToolInteractionLayer:()=>vc,Selected:()=>bc,ShowAxesHelper:()=>oc,SnapshotAPI:()=>Xs,Sphere:()=>Z,UUID:()=>us,WorldMatrix:()=>gs,WorldStateStoreAPI:()=>Ys,applyParsedPointCloud:()=>Tc,updateGeometryTrait:()=>Cc,writeMatrix:()=>wc}),ls=F(()=>``),us=F(()=>``),ds=F(()=>``),fs=F({x:0,y:0,z:0,oX:0,oY:0,oZ:1,theta:0}),ps=F(()=>new O),ms=F(()=>new O),hs=F(()=>new O),gs=F(()=>new O),_s=F(()=>({matrix:new O,index:-1})),vs=F(()=>!0),ys=F(()=>!0),bs=F(),xs=F(()=>!0),Ss=F(),Cs=F(()=>new se),ws=F(()=>``),Ts=F(()=>-1),Es=F({meshID:-1,instanceID:-1}),Ds=F({count:0}),Os=F(()=>0),ks=F(()=>1),As=F(()=>1),js=F({r:0,g:0,b:0}),Ms=F({depthTest:!1,depthWrite:!0}),Ns=F(()=>!0),Ps=F(()=>!0),Fs=F(()=>new Float32Array),Is=F(()=>new Uint8Array),Ls=F(()=>new Uint8Array),Rs=F({headAtPose:!0}),zs=F(()=>!0),Bs=F({total:0,shuffled:0}),Y=F({x:200,y:200,z:200}),X=F({l:200,r:50}),Z=F({r:200}),Q=F({r:50,l:200,capped:!0}),$=F(()=>new w),Vs=F(()=>({source:{url:``},animationName:``})),Hs=F(()=>!0),Us=F(()=>``),Ws=F(()=>!0),Gs=F(()=>!0),Ks=F(()=>!0),qs=F({index:0}),Js=F(()=>!0),Ys=F(()=>!0),Xs=F(()=>!0),Zs=F(()=>!0),Qs=F(()=>!0),$s=F(()=>!0),ec=F(),tc=F(()=>({arm:``,motion:``,joints:void 0,pose:void 0})),nc=F(()=>({id:``,name:``,order:0,sources:[],placeholder:void 0,pinned:!1,collapsed:!1,sceneless:!1,hasSettings:!1})),rc=[`warn`,`error`],ic=F(()=>new Map),ac=F(()=>!0),oc=F(()=>!0),sc=F(()=>({intrinsics:void 0})),cc=F(()=>({model:void 0})),lc=F({key:``}),uc=F(()=>!0),dc=F(()=>5),fc=F(()=>new Float32Array),pc=F(()=>5),mc=F(()=>new Uint8Array),hc=F(()=>10),gc=F(()=>!0),_c=F({loaded:0,total:0}),vc=F(()=>!0),yc=F(()=>!0),bc=F(),xc=F(()=>!0),Sc=e=>e.geometryType.case===`box`?Y(Tr(e.geometryType.value)):e.geometryType.case===`capsule`?X(Er(e.geometryType.value)):e.geometryType.case===`sphere`?Z(Dr(e.geometryType.value)):e.geometryType.case===`cylinder`?Q(Or(e.geometryType.value)):e.geometryType.case===`mesh`?$(Qr(e.geometryType.value)):gc,Cc=(e,t)=>{if(!t){e.remove(Y,X,Q,Z,$);return}if(t.geometryType.case===`box`){let n=Tr(t.geometryType.value);if(e.has(Y)){let t=e.get(Y);(t.x!==n.x||t.y!==n.y||t.z!==n.z)&&e.set(Y,n)}else e.remove(X,Q,Z,$),e.add(Y(n))}else if(t.geometryType.case===`capsule`){let n=Er(t.geometryType.value);if(e.has(X)){let t=e.get(X);(t.r!==n.r||t.l!==n.l)&&e.set(X,n)}else e.remove(Y,Q,Z,$),e.add(X(n))}else if(t.geometryType.case===`sphere`){let n=Dr(t.geometryType.value);e.has(Z)?e.get(Z).r!==n.r&&e.set(Z,n):(e.remove(Y,X,Q,$),e.add(Z(n)))}else if(t.geometryType.case===`cylinder`){let n=Or(t.geometryType.value);if(e.has(Q)){let t=e.get(Q);(t.r!==n.r||t.l!==n.l||t.capped!==n.capped)&&e.set(Q,n)}else e.remove(Y,X,Z,$),e.add(Q(n))}else if(t.geometryType.case===`mesh`){let n=t.geometryType.value;if(e.has($)){let t=e.get($);if(t&&$r(t,n))return;e.set($,Qr(n)),t?.dispose()}else e.remove(Y,Z,X,Q),e.add($(Qr(n)))}else t.geometryType.case===`pointcloud`&&Dc(e,t.geometryType.value.pointCloud)},wc=(e,t)=>{let n=e.get(ps);n&&Object.values(t).some(e=>e!==void 0)&&(new xr().setFromMatrix4(n).merge(t).toMatrix4(n),e.changed(ps))},Tc=(e,t,n)=>{ss(e,Bs,{total:t.positions.length/3,shuffled:t.shuffled});let r=e.get($);if(r){if((r.getAttribute(`position`)?.count??0)===t.positions.length/3)Hn(r,t.positions,{colors:n,colorFormat:wn.RGB},t.bounds),t.boundsTree&&is(r,t.boundsTree);else{let i=zn(t.positions,{colors:n,colorFormat:wn.RGB},t.bounds);t.boundsTree&&is(i,t.boundsTree),r.dispose(),e.set($,i)}return}e.remove(Y,X,Q,Z);let i=zn(t.positions,{colors:n,colorFormat:wn.RGB},t.bounds);t.boundsTree&&is(i,t.boundsTree),e.add($(i)),e.has(zs)||e.add(zs)},Ec=(e,t)=>{if(t.colors!==void 0||!e.has($))return t.colors;let n=e.get(js);if(!n)return;let r=t.positions.length/3,i=new Uint8Array(r*3),a=Math.round(n.r*255),o=Math.round(n.g*255),s=Math.round(n.b*255);for(let e=0;e<r;e++)i[e*3]=a,i[e*3+1]=o,i[e*3+2]=s;return i},Dc=(e,t)=>{Ir(new Uint8Array(t)).then(t=>{e.isAlive()&&Tc(e,t,Ec(e,t))}).catch(e=>{console.error(`Failed to update pointcloud buffer geometry:`,e)})},Oc=Symbol(`koota-context`);function kc(){let e=yn();globalThis.__koota__={world:e,traits:cs,relations:bn},s(Oc,e)}function Ac(){return u(Oc)}function jc(e){return typeof e?.spawn==`function`}function Mc(e,i){let s=Ac(),c=o(void 0),u=o(0);return n(()=>{let n=e();if(!n){l(c,void 0);return}let r=jc(n)?n:s,o=jc(n)?n[k].worldEntity:n;l(c,o.has(i)?o.get(i):void 0);let d=r.onChange(i,e=>{e===o&&(l(c,e.get(i)),t(()=>a(u)))}),f=r.onAdd(i,e=>{e===o&&l(c,e.get(i))}),p=r.onRemove(i,e=>{e===o&&l(c,void 0)});return()=>{d(),f(),p()}}),{get current(){return r(u),r(c)}}}var Nc=[e=>{e.renderMode=`realistic`},e=>{delete e.openFramePovWidgets}],Pc=Nc.length,Fc=e=>{let{migrationsApplied:t,...n}=e,r=typeof t==`number`?t:0;for(let e of Nc.slice(r))e(n);return n},Ic=Symbol(`dashboard-context`),Lc={poses:`poses`,pointclouds:`pointclouds`,vision:`vision`},Rc={poses:1e3,pointclouds:5e3,vision:1e3},zc=()=>({anthropicKey:``,cameraMode:`perspective`,cameraSmoothTime:.05,cameraDraggingSmoothTime:.05,enableDollyToCursor:!1,refreshRates:{...Rc},disabledCameras:{},disabledVisionServices:{},snapping:!1,snapIncrement:!0,snapObjects:!1,snapGroundPlane:!1,snapAlignRotation:!1,snapTranslate:.1,snapRotate:7.5,snapScale:.1,transformMode:`none`,transformSpace:`world`,grid:!0,gridCellSize:.5,gridSectionSize:10,gridFadeDistance:25,pointSize:.01,pointColor:`#333333`,pointBudget:8e5,maxPointSize:32,lineWidth:.005,lineDotSize:.005,interactionMode:`navigate`,enableMeasureAxisX:!0,enableMeasureAxisY:!0,enableMeasureAxisZ:!0,enableLabels:!1,enableSensorCoverage:!0,sensorCoverageRange:2,disabledCoverageCameras:{},renderStats:!1,renderArmModels:`colliders+model`,renderMode:`realistic`,enableXR:!1,xrMode:`frame-configure`,xrCameras:[],xrController:{left:{scaleFactor:1,rotationEnabled:!0},right:{scaleFactor:1,rotationEnabled:!0}}}),Bc=`settings`,Vc=e=>{let t=e===void 0?void 0:`${e}:${Bc}`,a=o(t===void 0),u=o(i(zc()));t!==void 0&&m(t).then(e=>{e&&l(u,{...r(u),...Fc(e)},!0)}).finally(()=>{l(a,!0)}),n(()=>{t!==void 0&&r(a)&&h(t,c({...r(u),interactionMode:`navigate`,migrationsApplied:Pc}))});let d={get current(){return r(u)},set current(e){l(u,e,!0)},get isLoaded(){return r(a)},merge(e){l(u,{...r(u),...e},!0)}};return s(Ic,d),d},Hc=()=>u(Ic);export{Cs as $,Wn as $t,nc as A,rs as At,Ts as B,Yr as Bt,Q as C,gs as Ct,$s as D,ss as Dt,Js as E,Cc as Et,ws as F,ns as Ft,Us as G,kr as Gt,Ds as H,Rr as Ht,vs as I,es as It,fc as J,ur as Jt,Gs as K,xr as Kt,rc as L,Ko as Lt,Hs as M,Zo as Mt,Vs as N,ts as Nt,ac as O,is as Ot,Sc as P,$o as Pt,ps as Q,Vn as Qt,xs as R,Bo as Rt,bs as S,us as St,hc as T,Tc as Tt,ys as U,Ir as Ut,_s as V,Vr as Vt,ic as W,wr as Wt,hs as X,Un as Xt,pc as Y,zn as Yt,Ms as Z,Hn as Zt,Ss as _,un as _n,vc as _t,Mc as a,In as an,ds as at,qs as b,Xs as bt,lc as c,wn as cn,Bs as ct,Y as d,xn as dn,Fs as dt,On as en,ls as et,$ as f,Cn as fn,gc as ft,_c as g,Rt as gn,uc as gt,fs as h,$t as hn,tc as ht,jc as i,Mn as in,As as it,ec as j,as as jt,ms as k,os as kt,Ps as l,Dn as ln,dc as lt,X as m,k as mn,Os as mt,Vc as n,kn as nn,Ks as nt,kc as o,Pn as on,Zs as ot,sc as p,Sn as pn,xc as pt,cc as q,mr as qt,Hc as r,Nn as rn,ks as rt,Ac as s,Fn as sn,Qs as st,Lc as t,jn as tn,yc as tt,Rs as u,En as un,zs as ut,js as v,St as vn,bc as vt,mc as w,Ys as wt,Ws as x,Z as xt,Is as y,F as yn,oc as yt,Es as z,R as zt};