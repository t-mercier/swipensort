(function(root){
'use strict';
const READ='https://www.googleapis.com/auth/contacts.readonly',WRITE='https://www.googleapis.com/auth/contacts';
let loading=null,accessToken='',expiresAt=0,writeAllowed=false,pending=false;
function ready(){
 if(root.google?.accounts?.oauth2)return Promise.resolve();
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>root.google?.accounts?.oauth2?resolve():reject(new Error('La connexion Google n’a pas pu être chargée.'));script.onerror=()=>{loading=null;script.remove();reject(new Error('Impossible de joindre Google. Vérifie ta connexion.'));};document.head.append(script);});
 return loading;
}
function authorize(write=false){
 if(pending)return Promise.reject(new Error('Une connexion Google est déjà en cours.'));
 if(!root.SwipeConfig?.googleClientId)return Promise.reject(new Error('La connexion Google n’est pas configurée.'));
 if(!root.google?.accounts?.oauth2)return Promise.reject(new Error('La connexion Google est encore en cours de chargement.'));
 if(write&&writeAllowed&&accessToken&&expiresAt>Date.now()+30000)return Promise.resolve(accessToken);
 pending=true;const scope=write?WRITE:READ;
 return new Promise((resolve,reject)=>{
  const fail=()=>{pending=false;reject(new Error('Connexion Google interrompue ou permission non accordée.'));};
  try{const client=root.google.accounts.oauth2.initTokenClient({client_id:root.SwipeConfig.googleClientId,scope,include_granted_scopes:false,error_callback:fail,callback:response=>{
   pending=false;if(response.error||!response.access_token||!root.google.accounts.oauth2.hasGrantedAllScopes(response,scope)){reject(new Error('L’autorisation Google demandée n’a pas été accordée.'));return;}
   accessToken=response.access_token;expiresAt=Date.now()+Math.max(0,Number(response.expires_in)||0)*1000;writeAllowed=write;resolve(accessToken);
  }});client.requestAccessToken({prompt:write?'':'select_account'});}catch{fail();}
 });
}
function clear(){accessToken='';expiresAt=0;writeAllowed=false;}
function disconnect(){const token=accessToken;clear();if(token&&root.google?.accounts?.oauth2)try{root.google.accounts.oauth2.revoke(token,()=>{});}catch{} }
root.GoogleAuth={ready,authorize,clear,disconnect};
})(globalThis);
