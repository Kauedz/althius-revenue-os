// GERADO por scripts/v18/convert.mjs a partir de althius-frontend-v18/fonte/template.html.
// Não edite à mão: altere o template ou o conversor e rode `npm run v18:sync`.
// @ts-nocheck
/* eslint-disable */
import React from 'react';
import { __arr, __cls, __css, __ck, __s, __t, __val } from './runtime';

export function renderTemplate($v: Record<string, any>) {
  return (
    <>
    <svg width="0" height="0" aria-hidden="true" style={{"position":"absolute","width":"0","height":"0"}}>
      <defs>
        {"\n    "}
        <linearGradient id="fogo-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD27A"></stop>
          <stop offset="1" stopColor="#F29A1F"></stop>
        </linearGradient>
        {"\n    "}
        <linearGradient id="fogo-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB547"></stop>
          <stop offset="0.55" stopColor="#FF6A2B"></stop>
          <stop offset="1" stopColor="#E8461C"></stop>
        </linearGradient>
        {"\n    "}
        <linearGradient id="fogo-3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A59"></stop>
          <stop offset="0.5" stopColor="#F7054F"></stop>
          <stop offset="1" stopColor="#A3003A"></stop>
        </linearGradient>
        {"\n    "}
        <linearGradient id="fogo-nucleo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6D6"></stop>
          <stop offset="1" stopColor="#FFD15C"></stop>
        </linearGradient>
        {"\n  "}
      </defs>
    </svg>
    <div ref={$v.refRoot} data-nav={$v.navEstado} data-densidade={$v.densidade} style={{"height":"100vh","display":"flex","overflow":"hidden","background":"var(--paper)","color":"var(--ink)","fontFamily":"var(--f-text)","fontWeight":"500","fontSize":"14px","lineHeight":"1.5","fontVariantNumeric":"tabular-nums"}}>
      {"\n\n  "}
      {$v.vSaiu ? (<>
        {"\n    "}
        <div style={{"flex":"1 1 auto","overflowY":"auto","display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(320px, 1fr))"}}>
          {"\n      "}
          <div style={{"background":"#131313","color":"#F4F4F4","padding":"56px 48px","display":"flex","flexDirection":"column","justifyContent":"space-between","gap":"40px","minHeight":"520px"}}>
            {"\n        "}
            <svg viewBox="0 0 352 299" style={{"width":"52px","height":"44px"}} role="img" aria-label="Althius">
              <path d="M115 0L0 299H81L127 61L169 299H251L141 0Z" fill="#F4F4F4"></path>
              <circle cx="308" cy="43" r="40" fill="#F7054F"></circle>
            </svg>
            {"\n        "}
            <div style={{"display":"flex","flexDirection":"column","gap":"18px"}}>
              {"\n          "}
              <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"50px","lineHeight":"1.06","letterSpacing":"-0.01em","textWrap":"balance"}}>
                {"Seu time de receita, agora com agentes."}
              </h1>
              {"\n          "}
              <p style={{"margin":"0","maxWidth":"420px","fontSize":"18px","lineHeight":"1.5","color":"#C1C1C1"}}>
                {"Estratégia, prospecção, campanhas e agentes no mesmo lugar."}
              </p>
              {"\n        "}
            </div>
            {"\n        "}
            <span style={{"fontFamily":"var(--f-hand)","fontSize":"30px","lineHeight":"1","color":"#F7054F"}}>
              {"bem-vindo"}
            </span>
            {"\n      "}
          </div>
          {"\n      "}
          <div style={{"padding":"56px 48px","display":"flex","alignItems":"center","justifyContent":"center"}}>
            {"\n        "}
            <div style={{"width":"100%","maxWidth":"400px","display":"flex","flexDirection":"column","gap":"22px"}}>
              {"\n          "}
              <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                {"\n            "}
                <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"34px"}}>
                  {"Acesse sua conta Althius"}
                </h2>
                {"\n          "}
              </div>
              {"\n          "}
              <label style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                {"\n            "}
                <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                  {"E-mail"}
                </span>
                {"\n            "}
                <input type="email" placeholder="voce@empresa.com.br" style={{"height":"48px","boxSizing":"border-box","padding":"0 14px","border":"1px solid var(--steel)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontWeight":"400","fontSize":"15px","outline":"none","borderRadius":"10px"}} />
                {"\n          "}
              </label>
              {"\n          "}
              <label style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                {"\n            "}
                <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                  {"Workspace"}
                </span>
                {"\n            "}
                <input placeholder="evolut.althius.com.br" style={{"height":"48px","boxSizing":"border-box","padding":"0 14px","border":"1px solid var(--steel)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontWeight":"400","fontSize":"15px","outline":"none","borderRadius":"10px"}} />
                {"\n          "}
              </label>
              {"\n          "}
              <button className={"b-pri"} onClick={$v.entrar} style={{"height":"50px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                {"Continuar"}
              </button>
              {"\n          "}
              <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                {"Primeiro acesso? Seu estrategista Althius envia o convite."}
              </span>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </div>
        {"\n  "}
      </>) : null}
      {"\n\n  "}
      {$v.vApp ? (<>
        {"\n\n    "}
        {$v.drawerAberto ? (<>
          {"\n      "}
          <div onClick={$v.fecharDrawer} style={{"position":"fixed","inset":"0","zIndex":"55","background":"var(--veil)"}}></div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        <div style={__css(`flex: 0 0 auto; display: ${__s($v.lay?.navDisplay)}; position: ${__s($v.lay?.navPos)}; left: 0; top: 0; bottom: 0; z-index: 60; height: 100%;`)}>
          {"\n      "}
          <nav aria-label="Workspaces" style={{"width":"64px","height":"100%","boxSizing":"border-box","background":"var(--rail)","borderRight":"1px solid var(--rail)","display":"flex","flexDirection":"column","alignItems":"center","gap":"12px","padding":"14px 0"}}>
            {"\n        "}
            <a href={$v.hrefHome} aria-label="Althius — início" style={{"display":"grid","placeItems":"center","width":"44px","height":"44px"}}>
              {"\n          "}
              <svg viewBox="0 0 352 299" style={{"width":"35px","height":"30px"}}>
                <path d="M115 0L0 299H81L127 61L169 299H251L141 0Z" fill="#F4F4F4"></path>
                <circle cx="308" cy="43" r="40" fill="#F7054F"></circle>
              </svg>
              {"\n        "}
            </a>
            {"\n        "}
            {__arr($v.railWs).map((w, $index) => (<React.Fragment key={$index}>
              {"\n          "}
              <a href={w?.href} title={w?.nome} aria-label={w?.nome} style={__css(`width: 40px; height: 40px; display: grid; place-items: center; font-size: 14px; color: ${__s(w?.cor)}; background: ${__s(w?.bg)}; border: 1px solid ${__s(w?.borda)}; border-radius: 10px; overflow: hidden; position: relative;`)}>
                {w?.semImg ? (<>
                  {__t(w?.sigla)}
                </>) : null}
                {w?.temImg ? (<>
                  <img className={"ws-img"} src={w?.img} onError={w?.imgErro} onLoad={w?.imgLoad} alt="" />
                </>) : null}
              </a>
              {"\n        "}
            </React.Fragment>))}
            {"\n        "}
            {$v.lay?.notMobile ? (<>
              {"\n          "}
              <button className={"rail-btn"} onClick={$v.alternarNav} aria-controls="nav-principal" aria-expanded={$v.navExpandido} aria-label={$v.navRotulo} title={undefined} style={{"marginTop":"auto","width":"40px","height":"40px","border":"none","borderRadius":"10px","background":"transparent","color":"#C1C1C1","cursor":"pointer","display":"grid","placeItems":"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="3"></rect>
                  <path d="M9.5 4.5v15"></path>
                  <path d={$v.navSeta}></path>
                </svg>
              </button>
              {"\n        "}
            </>) : null}
            {"\n      "}
          </nav>
          {"\n      "}
          <nav aria-label="Navegação principal" id="nav-principal" aria-hidden={$v.lay?.navOculta} style={__css(`width: ${__s($v.lay?.sideW)}; height: 100%; box-sizing: border-box; background: var(--mist); border-right: ${__s($v.lay?.navBorda)}; display: flex; flex-direction: column; overflow: hidden; visibility: ${__s($v.lay?.navVis)}; transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear ${__s($v.lay?.navVisDelay)};`)}>
            {"\n        "}
            <div style={{"flex":"0 0 auto","padding":"16px 16px 12px","borderBottom":"1px solid var(--rule)","minHeight":"64px","boxSizing":"border-box","display":"flex","flexDirection":"column","justifyContent":"center","gap":"2px"}}>
              {"\n          "}
              {$v.lay?.navFull ? (<>
                {"\n            "}
                <span style={{"display":"flex","alignItems":"center","gap":"10px","minWidth":"0"}}>
                  {$v.wsTemImg ? (<>
                    <span className={"co-logo"} style={{"width":"28px","height":"28px","borderRadius":"7px"}}>
                      <img src={$v.wsImg} onError={$v.wsImgErro} onLoad={$v.wsImgLoad} alt="" />
                    </span>
                  </>) : null}
                  <span style={{"fontSize":"18px","fontWeight":"500","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                    {__t($v.ws?.nome)}
                  </span>
                </span>
                {"\n            "}
                <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                  {__t($v.wsMeta)}
                </span>
                {"\n          "}
              </>) : null}
              {"\n          "}
              {$v.lay?.navCompact ? (<>
                <span style={{"fontSize":"14px","textAlign":"center"}}>
                  {__t($v.ws?.sigla)}
                </span>
              </>) : null}
              {"\n        "}
            </div>
            {"\n        "}
            <div style={{"flex":"1 1 auto","overflowY":"auto","overflowX":"hidden","padding":"12px 8px","display":"flex","flexDirection":"column","gap":"2px"}}>
              {"\n          "}
              {__arr($v.navTopo).map((n, $index) => (<React.Fragment key={$index}>
                {"\n            "}
                <a className={"navrow"} href={n?.href} onClick={$v.fecharDrawer} title={n?.label} aria-current={n?.atual} style={__css(`position: relative; min-height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 10px; font-size: 14px; background: ${__s(n?.bg)}; color: ${__s(n?.cor)}; justify-content: ${__s($v.lay?.navJust)};`)}>
                  {"\n              "}
                  {$v.lay?.navCompact ? (<>
                    <span style={{"fontSize":"13px"}}>
                      {__t(n?.sigla)}
                    </span>
                  </>) : null}
                  {"\n              "}
                  {$v.lay?.navFull ? (<>
                    <span style={{"flex":"1 1 auto","minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                      {__t(n?.label)}
                    </span>
                  </>) : null}
                  {"\n              "}
                  {n?.temBadge ? (<>
                    {$v.lay?.navFull ? (<>
                      <span style={{"minWidth":"20px","height":"20px","padding":"0 6px","boxSizing":"border-box","display":"grid","placeItems":"center","background":"#F7054F","color":"#FFFFFF","fontSize":"12px","fontWeight":"600","borderRadius":"999px"}}>
                        {__t(n?.badge)}
                      </span>
                    </>) : null}
                    {$v.lay?.navCompact ? (<>
                      <span aria-label={`${__s(n?.badge)} pendentes`} style={{"position":"absolute","top":"6px","right":"6px","width":"8px","height":"8px","borderRadius":"50%","background":"#F7054F"}}></span>
                    </>) : null}
                  </>) : null}
                  {"\n            "}
                </a>
                {"\n          "}
              </React.Fragment>))}
              {"\n          "}
              {$v.lay?.navFull ? (<>
                {"\n            "}
                <span style={{"margin":"16px 4px 6px 10px","display":"flex","alignItems":"center","justifyContent":"space-between","fontSize":"13px","color":"var(--graphite)"}}>
                  {"Canais"}
                  <button className={"icon-btn nav-add"} onClick={$v.novoCanal} aria-label="Criar canal" title="Criar canal">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"></path>
                    </svg>
                  </button>
                </span>
                {"\n            "}
                {__arr($v.canaisNav).map((c, $index) => (<React.Fragment key={$index}>
                  {"\n              "}
                  <a className={"navrow"} href={c?.href} onClick={$v.fecharDrawer} aria-current={c?.atual} style={__css(`min-height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 10px; font-size: 14px; background: ${__s(c?.bg)}; color: ${__s(c?.cor)};`)}>
                    {"\n                "}
                    <span style={__css(`color: ${__s(c?.hash)};`)}>
                      {"#"}
                    </span>
                    {"\n                "}
                    <span style={{"flex":"1 1 auto","minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                      {__t(c?.nome)}
                    </span>
                    {"\n                "}
                    {c?.temNovas ? (<>
                      <span style={{"minWidth":"20px","height":"20px","padding":"0 6px","boxSizing":"border-box","display":"grid","placeItems":"center","background":"#F7054F","color":"#FFFFFF","fontSize":"12px","fontWeight":"600","borderRadius":"999px"}}>
                        {__t(c?.novas)}
                      </span>
                    </>) : null}
                    {"\n              "}
                  </a>
                  {"\n            "}
                </React.Fragment>))}
                {"\n            "}
                <span style={{"margin":"16px 10px 6px","fontSize":"13px","color":"var(--graphite)"}}>
                  {"Agentes"}
                </span>
                {"\n            "}
                {__arr($v.agentesNav).map((a, $index) => (<React.Fragment key={$index}>
                  {"\n              "}
                  <a className={"navrow"} href={a?.href} onClick={$v.fecharDrawer} style={__css(`min-height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 10px; font-size: 14px; background: ${__s(a?.bg)}; color: ${__s(a?.cor)};`)}>
                    {"\n                "}
                    <span style={{"position":"relative","flex":"none","width":"24px","height":"24px","display":"grid","placeItems":"center","background":"var(--ink)","color":"var(--paper)","fontSize":"11px","borderRadius":"7px"}}>
                      {__t(a?.sigla)}
                      <span style={__css(`position: absolute; right: -3px; bottom: -3px; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--mist); background: ${__s(a?.status)};`)}></span>
                    </span>
                    {"\n                "}
                    <span style={{"minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                      {__t(a?.nome)}
                    </span>
                    {"\n              "}
                  </a>
                  {"\n            "}
                </React.Fragment>))}
                {"\n          "}
              </>) : null}
              {"\n          "}
              {__arr($v.navGrupos).map((g, $index) => (<React.Fragment key={$index}>
                {"\n            "}
                {$v.lay?.navFull ? (<>
                  {"\n              "}
                  <button className={"b-ghost"} onClick={g?.alternar} aria-expanded={g?.aberto} style={{"marginTop":"12px","minHeight":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 10px","border":"none","background":"transparent","fontFamily":"inherit","fontSize":"13px","color":"var(--graphite)","cursor":"pointer"}}>
                    {"\n                "}
                    <span style={{"flex":"1 1 auto","textAlign":"left"}}>
                      {__t(g?.secao)}
                    </span>
                    {"\n                "}
                    {g?.temBadge ? (<>
                      <span style={{"width":"7px","height":"7px","borderRadius":"50%","background":"#F7054F"}}></span>
                    </>) : null}
                    {"\n                "}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={__css(`flex: none; transform: rotate(${__s(g?.rot)}); transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);`)}>
                      <path d="M9 6l6 6-6 6"></path>
                    </svg>
                    {"\n              "}
                  </button>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.lay?.navCompact ? (<>
                  <span style={{"margin":"10px 12px 4px","height":"1px","background":"var(--rule)"}}></span>
                </>) : null}
                {"\n            "}
                {g?.mostra ? (<>
                  {"\n              "}
                  {__arr(g?.itens).map((n, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <a className={"navrow"} href={n?.href} onClick={$v.fecharDrawer} title={n?.label} aria-current={n?.atual} style={__css(`position: relative; min-height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 10px; font-size: 14px; background: ${__s(n?.bg)}; color: ${__s(n?.cor)}; justify-content: ${__s($v.lay?.navJust)};`)}>
                      {"\n                  "}
                      {$v.lay?.navCompact ? (<>
                        <span style={{"fontSize":"13px"}}>
                          {__t(n?.sigla)}
                        </span>
                      </>) : null}
                      {"\n                  "}
                      {$v.lay?.navFull ? (<>
                        <span style={{"flex":"1 1 auto","minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                          {__t(n?.label)}
                        </span>
                      </>) : null}
                      {"\n                  "}
                      {n?.temBadge ? (<>
                        {$v.lay?.navFull ? (<>
                          <span style={{"minWidth":"20px","height":"20px","padding":"0 6px","boxSizing":"border-box","display":"grid","placeItems":"center","background":"#F7054F","color":"#FFFFFF","fontSize":"12px","fontWeight":"600","borderRadius":"999px"}}>
                            {__t(n?.badge)}
                          </span>
                        </>) : null}
                        {$v.lay?.navCompact ? (<>
                          <span aria-label={`${__s(n?.badge)} pendentes`} style={{"position":"absolute","top":"6px","right":"6px","width":"8px","height":"8px","borderRadius":"50%","background":"#F7054F"}}></span>
                        </>) : null}
                      </>) : null}
                      {"\n                "}
                    </a>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </React.Fragment>))}
              {"\n        "}
            </div>
            {"\n        "}
            <div style={__css(`flex: 0 0 auto; padding: 12px 14px; border-top: 1px solid var(--rule); display: flex; align-items: center; gap: 10px; justify-content: ${__s($v.lay?.navJust)};`)}>
              {"\n          "}
              <span style={{"position":"relative","flex":"none","width":"34px","height":"34px","borderRadius":"50%","background":"var(--ink)","color":"var(--paper)","display":"grid","placeItems":"center","fontSize":"13px","overflow":"hidden"}}>
                {__t($v.usuario?.sigla)}
                {$v.temMinhaFoto ? (<>
                  <img className={"foto"} src={$v.minhaFoto} alt="" style={{"position":"absolute","inset":"0","width":"100%","height":"100%"}} />
                </>) : null}
              </span>
              {"\n          "}
              {$v.lay?.navFull ? (<>
                {"\n            "}
                <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column"}}>
                  <span style={{"fontSize":"14px","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                    {__t($v.usuario?.usuario)}
                  </span>
                  <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                    {__t($v.usuario?.label)}
                  </span>
                </span>
                {"\n            "}
                {$v.podeConfig ? (<>
                  {"\n              "}
                  <a className={"rodape-cfg"} href={$v.hrefConfig} onClick={$v.fecharDrawer} aria-label="Configurações" title="Configurações" style={{"width":"40px","height":"40px","display":"grid","placeItems":"center","color":"var(--graphite)","borderRadius":"10px"}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </a>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </>) : null}
              {"\n        "}
            </div>
            {"\n      "}
          </nav>
          {"\n    "}
        </div>
        {"\n\n    "}
        <div style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column"}}>
          {"\n      "}
          <header style={{"position":"relative","flex":"0 0 auto","minHeight":"64px","boxSizing":"border-box","display":"flex","alignItems":"center","gap":"10px","padding":"10px 24px","borderBottom":"1px solid var(--rule)","background":"var(--paper)"}}>
            {"\n        "}
            {$v.lay?.notMobile ? (<>
              {"\n          "}
              <button className={"b-sec"} onClick={$v.alternarNav} aria-controls="nav-principal" aria-expanded={$v.navExpandido} aria-label={$v.navRotulo} title={undefined} style={{"flex":"none","width":"40px","height":"40px","border":"1px solid var(--rule)","borderRadius":"10px","background":"var(--paper)","color":"var(--ink)","cursor":"pointer","display":"grid","placeItems":"center"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="3"></rect>
                  <path d="M9.5 4.5v15"></path>
                  <path d={$v.navSeta}></path>
                </svg>
              </button>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.lay?.mobile ? (<>
              {"\n          "}
              <button className={"b-sec"} onClick={$v.abrirDrawer} aria-label="Abrir navegação" style={{"width":"44px","height":"44px","border":"1px solid var(--rule)","background":"var(--paper)","cursor":"pointer","display":"grid","placeItems":"center","borderRadius":"10px"}}>
                {"\n            "}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7h16M4 12h16M4 17h16"></path>
                </svg>
                {"\n          "}
              </button>
              {"\n        "}
            </>) : null}
            {"\n        "}
            <div style={{"flex":"1 1 auto","minWidth":"0","display":"flex","alignItems":"baseline","gap":"12px","flexWrap":"wrap"}}>
              {"\n          "}
              <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"20px","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                {__t($v.tituloPagina)}
              </h1>
              {"\n          "}
              {$v.lay?.notMobile ? (<>
                <span style={{"fontSize":"14px","color":"var(--graphite)","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                  {__t($v.subtituloPagina)}
                </span>
              </>) : null}
              {"\n        "}
            </div>
            {"\n        "}
            <button className={"b-sec"} onClick={$v.abrirPaleta} aria-label="Buscar e comandos" style={{"height":"44px","display":"flex","alignItems":"center","gap":"8px","padding":"0 12px","border":"1px solid var(--rule)","background":"var(--paper)","color":"var(--graphite)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","whiteSpace":"nowrap","borderRadius":"10px"}}>
              {"\n          "}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="6.5"></circle>
                <path d="M16 16l4 4"></path>
              </svg>
              {"\n          "}
              {$v.lay?.full ? (<>
                <span>
                  {"Buscar"}
                </span>
                <span style={{"fontSize":"12px","border":"1px solid var(--steel)","padding":"1px 6px","borderRadius":"14px"}}>
                  {__t($v.atalho)}
                </span>
              </>) : null}
              {"\n        "}
            </button>
            {"\n        "}
            {$v.podeTrocarWs ? (<>
              {"\n          "}
              <label style={{"display":"flex","alignItems":"center"}}>
                {"\n            "}
                <span style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                  {"Workspace"}
                </span>
                {"\n            "}
                <select value={__val($v.ws?.id)} onChange={$v.mudarWs} style={{"height":"44px","maxWidth":"170px","padding":"0 10px","border":"1px solid var(--rule)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                  {"\n              "}
                  {__arr($v.workspaces).map((w, $index) => (<React.Fragment key={$index}>
                    <option value={__val(w?.id)}>
                      {__t(w?.nome)}
                    </option>
                  </React.Fragment>))}
                  {"\n            "}
                </select>
                {"\n          "}
              </label>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.podeCopiloto ? (<>
              {"\n          "}
              <button className={"b-pri"} onClick={$v.abrirCopiloto} style={{"height":"44px","padding":"0 14px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","whiteSpace":"nowrap","display":"flex","alignItems":"center","gap":"8px","borderRadius":"10px"}}>
                {"\n            "}
                <span style={{"width":"7px","height":"7px","borderRadius":"50%","background":"#F7054F"}}></span>
                {"Copiloto\n          "}
              </button>
              {"\n        "}
            </>) : null}
            {"\n        "}
            <button className={"b-sec"} onClick={$v.alternarTema} aria-label={$v.temaRotulo} title={$v.temaRotulo} style={{"width":"44px","height":"44px","border":"1px solid var(--rule)","borderRadius":"10px","background":"var(--paper)","color":"var(--ink)","cursor":"pointer","display":"grid","placeItems":"center"}}>
              {$v.temaEscuro ? (<>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"></path>
                </svg>
              </>) : null}
              {$v.temaClaro ? (<>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"></path>
                </svg>
              </>) : null}
            </button>
            {"\n        "}
            <div style={{"position":"relative"}}>
              {"\n          "}
              <button className={"b-sec"} onClick={$v.alternarNotif} aria-label="Notificações" aria-expanded={$v.notifAberto} style={{"position":"relative","width":"44px","height":"44px","border":"1px solid var(--rule)","background":"var(--paper)","cursor":"pointer","display":"grid","placeItems":"center","borderRadius":"10px"}}>
                {"\n            "}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M12 4c3.6 0 6 2.6 6 6.2V15l1.6 2.4H4.4L6 15v-4.8C6 6.6 8.4 4 12 4zM10 20h4"></path>
                </svg>
                {"\n            "}
                {$v.temNaoLidas ? (<>
                  <span style={{"position":"absolute","top":"8px","right":"8px","width":"8px","height":"8px","borderRadius":"50%","background":"#F7054F","boxShadow":"0 0 0 2px var(--paper)"}}></span>
                </>) : null}
                {"\n          "}
              </button>
              {"\n          "}
              {$v.notifAberto ? (<>
                {"\n            "}
                <div className={"feed"} role="dialog" aria-label="Notificações" style={{"position":"absolute","right":"0","top":"calc(100% + 8px)","zIndex":"70","width":"360px","maxWidth":"88vw","background":"var(--paper)","border":"1px solid var(--rule)","borderRadius":"14px","overflow":"hidden","boxShadow":"0 2px 4px rgba(19,19,19,0.06), 0 14px 18px -12px rgba(19,19,19,0.28)"}}>
                  {"\n              "}
                  <div style={{"position":"relative","padding":"12px 16px","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"center","gap":"12px"}}>
                    {"\n                "}
                    <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column"}}>
                      <span style={{"fontSize":"14px","fontWeight":"500"}}>
                        {"Notificações"}
                      </span>
                      <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                        {__t($v.notifResumo)}
                      </span>
                    </span>
                    {"\n                "}
                    {$v.temNaoLidas ? (<>
                      <button className={"b-ghost"} onClick={$v.marcarLidas} style={{"height":"32px","padding":"0 10px","border":"none","borderRadius":"8px","background":"transparent","color":"var(--ink)","fontFamily":"inherit","fontSize":"12px","cursor":"pointer"}}>
                        {"Marcar como lidas"}
                      </button>
                    </>) : null}
                    {"\n                "}
                    <span className={"feed-progress"} aria-hidden="true">
                      <span ref={$v.refFeedProg}></span>
                    </span>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div className={"scroll-area"} onScroll={$v.feedScroll} style={{"maxHeight":"320px","overflowY":"auto","padding":"6px"}}>
                    {"\n                "}
                    {__arr($v.notifs).map((n, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div className={"feed-item"} style={__css(`--i: ${__s(n?.i)};`)}>
                        {"\n                    "}
                        <span className={"feed-ico"} style={__css(`color: ${__s(n?.cor)}; background: ${__s(n?.tinta)};`)}>
                          {n?.i_aprov ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="4" y="4" width="16" height="16" rx="3"></rect>
                              <path d="M8.5 12.5l2.5 2.5 4.5-5"></path>
                            </svg>
                          </>) : null}
                          {n?.i_alerta ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 4l9 16H3z"></path>
                              <path d="M12 10v4M12 17.5v.01"></path>
                            </svg>
                          </>) : null}
                          {n?.i_ok ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="8.5"></circle>
                              <path d="M8.5 12.5l2.5 2.5 4.5-5"></path>
                            </svg>
                          </>) : null}
                          {n?.i_msg ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 5h16v11H9l-5 4z"></path>
                            </svg>
                          </>) : null}
                          {n?.i_alvo ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="8.5"></circle>
                              <circle cx="12" cy="12" r="4.5"></circle>
                              <circle cx="12" cy="12" r="0.8"></circle>
                            </svg>
                          </>) : null}
                          {n?.i_lista ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>
                            </svg>
                          </>) : null}
                          {n?.i_alta ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 17l6-6 4 4 8-8"></path>
                              <path d="M15 7h6v6"></path>
                            </svg>
                          </>) : null}
                        </span>
                        {"\n                    "}
                        <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"1px"}}>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","fontWeight":"500","lineHeight":"1.35"}}>
                            {__t(n?.titulo)}
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","color":"var(--graphite)","lineHeight":"1.35"}}>
                            {__t(n?.texto)}
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"12px","color":"var(--muted)"}}>
                            {__t(n?.quando)}
                          </span>
                          {"\n                    "}
                        </span>
                        {"\n                    "}
                        <span style={__css(`flex: none; margin-top: 6px; width: 8px; height: 8px; border-radius: 50%; background: ${__s(n?.ponto)};`)}></span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n          "}
              </>) : null}
              {"\n        "}
            </div>
            {"\n        "}
            <div style={{"position":"relative"}}>
              {"\n          "}
              <button className={"b-sec"} onClick={$v.alternarAvatar} aria-label="Perfil e papel" aria-expanded={$v.avatarAberto} style={{"width":"44px","height":"44px","borderRadius":"50%","border":"1px solid var(--ink)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","position":"relative","overflow":"hidden"}}>
                {__t($v.usuario?.sigla)}
                {$v.temMinhaFoto ? (<>
                  <img className={"foto"} src={$v.minhaFoto} alt="" style={{"position":"absolute","inset":"0","width":"100%","height":"100%"}} />
                </>) : null}
              </button>
              {"\n          "}
              {$v.avatarAberto ? (<>
                {"\n            "}
                <div role="dialog" aria-label="Perfil" style={{"position":"absolute","right":"0","top":"calc(100% + 8px)","zIndex":"70","width":"280px","background":"var(--paper)","border":"1px solid var(--rule)","boxShadow":"0 2px 4px rgba(19,19,19,0.06), 0 14px 18px -12px rgba(19,19,19,0.28)","borderRadius":"14px","overflow":"hidden"}}>
                  {"\n              "}
                  <div style={{"padding":"16px","borderBottom":"1px solid var(--rule)","display":"flex","flexDirection":"column","gap":"2px"}}>
                    {"\n                "}
                    <span style={{"fontSize":"15px","fontWeight":"500"}}>
                      {__t($v.usuario?.usuario)}
                    </span>
                    {"\n                "}
                    <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                      {__t($v.usuario?.email)}
                    </span>
                    {"\n                "}
                    <span style={{"marginTop":"6px","alignSelf":"flex-start","padding":"2px 8px","border":"1px solid var(--ink)","fontSize":"12px","fontWeight":"500","borderRadius":"999px"}}>
                      {__t($v.usuario?.label)}
                    </span>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"padding":"10px 8px","borderBottom":"1px solid var(--rule)","display":"flex","flexDirection":"column","gap":"2px"}}>
                    {"\n                "}
                    <span style={{"padding":"4px 8px 6px","fontSize":"13px","color":"var(--graphite)"}}>
                      {"Modo demonstração · papel"}
                    </span>
                    {"\n                "}
                    {__arr($v.papeis).map((p, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button className={"navrow"} onClick={p?.escolher} aria-pressed={p?.ativo} style={__css(`min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px; border: none; background: ${__s(p?.bg)}; color: var(--ink); font-family: inherit; font-size: 14px; cursor: pointer; text-align: left;`)}>
                        {"\n                    "}
                        <span style={{"width":"14px","height":"14px","borderRadius":"50%","border":"1px solid var(--ink)","display":"grid","placeItems":"center"}}>
                          <span style={__css(`width: 6px; height: 6px; border-radius: 50%; background: ${__s(p?.ponto)};`)}></span>
                        </span>
                        {__t(p?.label)}{"\n                  "}
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"padding":"12px 16px","borderBottom":"1px solid var(--rule)","display":"flex","flexDirection":"column","gap":"8px"}}>
                    {"\n                "}
                    <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                      {"Tema"}
                    </span>
                    {"\n                "}
                    <div className={"seg"} role="radiogroup" aria-label="Tema">
                      {"\n                  "}
                      {__arr($v.temas).map((t, $index) => (<React.Fragment key={$index}>
                        <button role="radio" aria-checked={t?.ativo} onClick={t?.escolher}>
                          {__t(t?.label)}
                        </button>
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <button className={"b-ghost"} onClick={$v.sair} style={{"width":"100%","minHeight":"44px","padding":"0 16px","border":"none","background":"var(--paper)","color":"var(--err)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","textAlign":"left"}}>
                    {"Sair"}
                  </button>
                  {"\n            "}
                </div>
                {"\n          "}
              </>) : null}
              {"\n        "}
            </div>
            {"\n        "}
            <span className={"scroll-progress"} aria-hidden="true">
              <span ref={$v.refProg}></span>
            </span>
            {"\n      "}
          </header>
          {"\n\n      "}
          {$v.bannerOffline ? (<>
            {"\n        "}
            <div role="status" style={{"flex":"0 0 auto","padding":"10px 20px","background":"var(--ink)","color":"var(--mist)","fontSize":"14px","display":"flex","gap":"10px","alignItems":"center"}}>
              <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--warn)"}}></span>
              {"Você está offline. Exibindo a última versão salva; ações ficam na fila até a conexão voltar."}
            </div>
            {"\n      "}
          </>) : null}
          {"\n      "}
          {$v.bannerDesatualizado ? (<>
            {"\n        "}
            <div role="status" style={{"flex":"0 0 auto","padding":"8px 20px","background":"var(--mist)","borderBottom":"1px solid var(--rule)","fontSize":"14px","display":"flex","gap":"12px","alignItems":"center","flexWrap":"wrap"}}>
              <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--warn)"}}></span>
              <span style={{"flex":"1 1 auto"}}>
                {"Dados atualizados há 2 horas. A sincronização com o CRM está atrasada."}
              </span>
              <button className={"b-sec"} onClick={$v.recarregar} style={{"height":"36px","padding":"0 12px","border":"1px solid var(--ink)","background":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                {"Atualizar agora"}
              </button>
            </div>
            {"\n      "}
          </>) : null}
          {"\n\n      "}
          <main ref={$v.refMain} style={{"flex":"1 1 auto","minHeight":"0","overflowY":"auto","background":"var(--paper)"}}>
            {"\n\n        "}
            {$v.vCarregando ? (<>
              {"\n          "}
              <div aria-busy="true" aria-live="polite" style={{"position":"relative"}}>
                {"\n            "}
                <div className={"loadline"} role="status">
                  <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"16px"}}>
                    <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                  </svg>
                  <span>
                    {"Carregando "}{__t($v.paginaLabel)}{"…"}
                  </span>
                </div>
                {"\n            "}
                <div style={{"padding":"28px 24px","display":"flex","flexDirection":"column","gap":"22px","maxWidth":"1180px"}}>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"10px"}}>
                    <span className={"sk"} style={{"width":"120px","height":"12px"}}></span>
                    <span className={"sk"} style={{"width":"min(340px, 70%)","height":"30px"}}></span>
                  </div>
                  {"\n              "}
                  <div className={"ledger"} style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(160px, 1fr))"}}>
                    {"\n                "}
                    <div style={{"background":"var(--paper)","padding":"18px","display":"flex","flexDirection":"column","gap":"10px"}}>
                      <span className={"sk"} style={{"width":"60%","height":"11px"}}></span>
                      <span className={"sk"} style={{"width":"45%","height":"26px"}}></span>
                    </div>
                    {"\n                "}
                    <div style={{"background":"var(--paper)","padding":"18px","display":"flex","flexDirection":"column","gap":"10px"}}>
                      <span className={"sk"} style={{"width":"55%","height":"11px"}}></span>
                      <span className={"sk"} style={{"width":"35%","height":"26px"}}></span>
                    </div>
                    {"\n                "}
                    <div style={{"background":"var(--paper)","padding":"18px","display":"flex","flexDirection":"column","gap":"10px"}}>
                      <span className={"sk"} style={{"width":"65%","height":"11px"}}></span>
                      <span className={"sk"} style={{"width":"40%","height":"26px"}}></span>
                    </div>
                    {"\n                "}
                    <div style={{"background":"var(--paper)","padding":"18px","display":"flex","flexDirection":"column","gap":"10px"}}>
                      <span className={"sk"} style={{"width":"50%","height":"11px"}}></span>
                      <span className={"sk"} style={{"width":"30%","height":"26px"}}></span>
                    </div>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column"}}>
                    {"\n                "}
                    <div style={{"padding":"14px 0","borderBottom":"1px solid var(--mist)","display":"flex","gap":"14px","alignItems":"center"}}>
                      <span className={"sk"} style={{"width":"32px","height":"32px","borderRadius":"50%","flex":"none"}}></span>
                      <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"8px"}}>
                        <span className={"sk"} style={{"width":"38%","height":"12px"}}></span>
                        <span className={"sk"} style={{"width":"72%","height":"12px"}}></span>
                      </span>
                    </div>
                    {"\n                "}
                    <div style={{"padding":"14px 0","borderBottom":"1px solid var(--mist)","display":"flex","gap":"14px","alignItems":"center"}}>
                      <span className={"sk"} style={{"width":"32px","height":"32px","borderRadius":"50%","flex":"none"}}></span>
                      <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"8px"}}>
                        <span className={"sk"} style={{"width":"30%","height":"12px"}}></span>
                        <span className={"sk"} style={{"width":"64%","height":"12px"}}></span>
                      </span>
                    </div>
                    {"\n                "}
                    <div style={{"padding":"14px 0","display":"flex","gap":"14px","alignItems":"center"}}>
                      <span className={"sk"} style={{"width":"32px","height":"32px","borderRadius":"50%","flex":"none"}}></span>
                      <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"8px"}}>
                        <span className={"sk"} style={{"width":"42%","height":"12px"}}></span>
                        <span className={"sk"} style={{"width":"58%","height":"12px"}}></span>
                      </span>
                    </div>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vErro ? (<>
              {"\n          "}
              <div role="alert" style={{"padding":"48px 24px","maxWidth":"560px","display":"flex","flexDirection":"column","gap":"12px"}}>
                {"\n            "}
                <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"30px"}}>
                  {"Não conseguimos carregar "}{__t($v.paginaLabel)}
                </h1>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"15px","color":"var(--graphite)"}}>
                  {"O serviço de dados não respondeu. Nada foi alterado. Tente de novo; se persistir, o estrategista responsável é notificado."}
                </p>
                {"\n            "}
                <button className={"b-pri"} onClick={$v.recarregar} style={{"alignSelf":"flex-start","height":"44px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                  {"Tentar novamente"}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vNegado ? (<>
              {"\n          "}
              <div role="alert" style={{"padding":"48px 24px","maxWidth":"560px","display":"flex","flexDirection":"column","gap":"12px"}}>
                {"\n            "}
                <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"30px"}}>
                  {"Esta área não faz parte do seu acesso"}
                </h1>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"15px","color":"var(--graphite)"}}>
                  {"Seu papel ("}{__t($v.usuario?.label)}{") não inclui esta página. Se precisar dela, peça ao administrador do workspace."}
                </p>
                {"\n            "}
                <a href={$v.hrefHome} style={{"alignSelf":"flex-start","height":"44px","padding":"0 18px","display":"flex","alignItems":"center","border":"1px solid var(--ink)","fontSize":"14px","borderRadius":"10px"}}>
                  {"Voltar ao início"}
                </a>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vFase ? (<>
              {"\n          "}
              <div style={{"padding":"48px 24px","maxWidth":"620px","display":"flex","flexDirection":"column","gap":"12px"}}>
                {"\n            "}
                <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"34px"}}>
                  {__t($v.paginaLabel)}
                </h1>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"15px","color":"var(--graphite)"}}>
                  {"Rota, permissão e navegação já estão ativas. O conteúdo deste módulo entra na fase "}{__t($v.faseNum)}{" do plano."}
                </p>
                {"\n            "}
                <ol className={"tl tl-alt"} aria-label="Fases do plano" style={{"marginTop":"20px"}}>
                  {"\n              "}
                  {__arr($v.fasesPlano).map((f, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <li className={"tl-item"} data-state={f?.st}>
                      {"\n                  "}
                      <span className={"tl-sep"}></span>
                      {"\n                  "}
                      <span className={"tl-ind"}></span>
                      {"\n                  "}
                      <time className={"tl-date"}>
                        {__t(f?.label)}
                      </time>
                      {"\n                  "}
                      <span className={"tl-title"}>
                        {__t(f?.titulo)}
                      </span>
                      {"\n                  "}
                      <span className={"tl-content"}>
                        {__t(f?.det)}
                      </span>
                      {"\n                "}
                    </li>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </ol>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vHome ? (<>
              {"\n          "}
              <div style={{"padding":"28px 24px 48px","maxWidth":"1320px","display":"flex","flexDirection":"column","gap":"28px"}}>
                {"\n            "}
                <div style={{"display":"flex","alignItems":"flex-end","justifyContent":"space-between","gap":"16px","flexWrap":"wrap"}}>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                    {"\n                "}
                    <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"38px","lineHeight":"1.1"}}>
                      {__t($v.ws?.nome)}
                    </h1>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                    <select value={__val($v.periodo)} onChange={$v.mudarPeriodo} aria-label="Período" style={{"height":"44px","padding":"0 10px","border":"1px solid var(--rule)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                      <option value={__val("Últimos 7 dias")}>
                        {"Últimos 7 dias"}
                      </option>
                      <option value={__val("Este mês")}>
                        {"Este mês"}
                      </option>
                      <option value={__val("Este trimestre")}>
                        {"Este trimestre"}
                      </option>
                    </select>
                    <button className={"b-pri"} onClick={$v.homeCta?.acao} style={{"height":"44px","padding":"0 20px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                      {__t($v.homeCta?.label)}
                    </button>
                  </div>
                  {"\n            "}
                </div>
                {"\n\n            "}
                <section className={"ledger"} aria-label="Indicadores" style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(160px, 1fr))"}}>
                  {"\n              "}
                  {__arr($v.kpis).map((k, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <div style={{"padding":"18px 18px 16px","display":"flex","flexDirection":"column","gap":"6px"}}>
                      {"\n                  "}
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t(k?.label)}
                      </span>
                      {"\n                  "}
                      <span style={{"fontFamily":"var(--f-display)","fontSize":"30px","lineHeight":"1.05","fontWeight":"400","fontVariantNumeric":"tabular-nums"}}>
                        {__t(k?.valor)}
                      </span>
                      {"\n                  "}
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t(k?.delta)}
                      </span>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </section>
                {"\n\n            "}
                {$v.mostraOperacao ? (<>
                  {"\n                  "}
                  <section style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                    {"\n                    "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                      {"Operação agora"}
                    </h2>
                    {"\n                    "}
                    <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(190px, 1fr))","columnGap":"28px","borderTop":"1px solid var(--ink)"}}>
                      {"\n                      "}
                      {__arr($v.operacao).map((o, $index) => (<React.Fragment key={$index}>
                        {"\n                        "}
                        <a href={o?.href} style={{"minHeight":"48px","boxSizing":"border-box","padding":"10px 0","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"center","justifyContent":"space-between","gap":"12px"}}>
                          {"\n                          "}
                          <span style={{"fontSize":"14px"}}>
                            {__t(o?.label)}
                          </span>
                          <span style={__css(`font-family: var(--f-display); font-size: 22px; color: ${__s(o?.cor)};`)}>
                            {__t(o?.n)}
                          </span>
                          {"\n                        "}
                        </a>
                        {"\n                      "}
                      </React.Fragment>))}
                      {"\n                    "}
                    </div>
                    {"\n                  "}
                  </section>
                  {"\n                "}
                </>) : null}
                {"\n\n            "}
                <section className={"mapa-card"} aria-label="Mapa de contas">
                  {"\n              "}
                  <div className={"mapa-head"}>
                    {"\n                "}
                    <div style={{"display":"flex","flexDirection":"column","gap":"3px","minWidth":"0"}}>
                      <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"20px"}}>
                        {"Mapa de contas"}
                      </h2>
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t($v.mapa?.resumo)}
                      </span>
                    </div>
                    {"\n                "}
                    <div className={"seg seg-li"} role="radiogroup" aria-label="Período do mapa">
                      {__arr($v.mapa?.periodos).map((o, $index) => (<React.Fragment key={$index}>
                        <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                          {__t(o?.label)}
                        </button>
                      </React.Fragment>))}
                    </div>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div className={"mapa-body"}>
                    {"\n                "}
                    <div className={"mapa-wrap"}>
                      <div className={"mapa-geo"}>
                        {"\n                  "}
                        <svg className={"mapa-svg"} viewBox="-4 -2 466 480" role="group" aria-label="Mapa do Brasil por estado">
                          {"\n              "}
                          <path className={"uf"} d="M4.6 152.5L17.9 158.7L44.4 164.9L63.4 175.2L87.9 185.9L87.8 186.4L84.9 188.2L82.9 190.5L78.7 191.7L78.3 192.6L75.6 194.5L75.3 195.7L73.3 194.9L71.2 195.2L69.1 198.7L65.6 200.5L63.6 200.9L63.1 199.2L60.3 199.3L55.4 198.3L51.7 198.9L49.4 198.3L45.1 200.0L43.6 199.7L42.5 198.4L41.5 199.2L41.5 185.1L42.4 184.4L41.7 181.9L42.2 182.1L43.0 180.3L41.8 180.5L37.1 185.0L35.2 185.7L34.6 186.8L23.4 187.2L23.8 184.8L22.4 184.2L22.6 182.6L21.4 181.1L17.2 180.1L11.4 180.1L13.8 177.7L14.6 175.1L12.4 171.7L10.5 170.6L10.7 168.9L9.4 168.8L7.7 167.3L6.6 163.5L5.0 162.1L5.1 161.5L5.8 161.6L6.0 160.5L4.3 159.8L2.5 157.9L3.3 156.8L2.8 155.3L3.8 155.7L5.8 154.9L4.6 152.5Z" fill={$v.mapa?.f?.AC} data-sel={$v.mapa?.s?.AC} data-dim={$v.mapa?.x?.AC} aria-label={$v.mapa?.l?.AC} onClick={$v.mapa?.c?.AC}></path>
                          {"\n              "}
                          <path className={"uf"} d="M449.0 173.1L452.6 174.2L450.9 177.4L450.3 178.3L439.6 190.5L438.2 193.2L437.5 192.1L436.2 192.2L435.6 190.3L434.4 190.4L432.2 188.9L431.3 186.9L428.4 185.9L426.3 184.3L424.5 184.0L422.9 182.8L422.1 182.9L418.7 180.5L417.2 180.2L416.9 179.2L418.5 177.3L419.8 177.0L422.4 173.5L423.1 175.1L425.5 174.8L425.8 175.5L427.5 176.3L428.5 178.1L428.9 177.8L429.3 178.5L430.0 178.1L431.7 179.8L432.7 178.4L434.7 178.5L435.8 179.3L437.7 177.7L440.2 177.2L439.7 176.4L441.3 175.6L441.3 174.7L442.0 174.2L445.2 173.4L445.7 174.2L449.0 173.1ZM451.0 177.0L451.0 177.0L451.0 177.0L451.0 177.0Z" fill={$v.mapa?.f?.AL} data-sel={$v.mapa?.s?.AL} data-dim={$v.mapa?.x?.AL} aria-label={$v.mapa?.l?.AL} onClick={$v.mapa?.c?.AL}></path>
                          {"\n              "}
                          <path className={"uf"} d="M79.5 40.7L80.2 44.7L81.6 45.0L82.3 46.4L82.4 53.2L85.1 52.4L91.4 58.1L94.0 58.1L94.2 57.5L95.5 57.5L96.4 56.0L99.9 55.1L100.9 56.6L99.8 58.5L100.4 59.4L101.7 58.7L102.8 56.0L104.5 56.1L104.8 53.7L105.5 53.3L106.4 53.8L107.1 52.4L108.2 52.4L108.8 51.4L109.6 52.5L113.6 48.9L114.2 49.2L113.6 50.5L114.3 50.8L114.7 49.6L117.1 47.8L117.5 44.0L118.3 43.4L122.1 43.0L122.7 41.9L124.9 41.6L125.5 40.7L126.5 41.3L128.2 41.1L129.6 43.0L131.7 43.0L133.2 43.9L133.0 46.6L132.1 48.1L134.0 50.0L135.1 53.7L136.0 54.2L136.3 55.5L136.1 57.8L135.2 58.9L135.2 61.1L136.2 62.6L136.5 66.1L138.6 69.3L138.5 70.8L139.2 71.2L137.8 73.4L138.0 75.0L136.7 75.9L135.8 75.4L135.5 76.3L141.0 80.6L142.6 83.9L145.6 84.4L147.5 86.1L146.8 84.4L145.8 83.9L146.7 79.9L146.2 78.4L147.6 75.2L150.4 73.9L150.5 73.2L153.9 73.9L155.8 76.3L155.9 77.5L156.9 77.9L158.4 77.7L159.0 76.4L161.0 75.9L160.0 73.3L161.1 69.7L164.2 64.0L177.4 64.0L177.7 71.3L179.3 72.4L179.6 75.3L182.7 77.8L182.8 79.5L184.0 80.9L184.8 80.8L185.9 82.0L187.6 80.5L188.2 84.0L191.1 85.2L191.5 86.3L192.4 86.0L193.2 87.0L194.7 87.3L194.8 87.9L197.5 87.8L198.6 88.9L198.9 90.1L201.0 91.4L202.5 91.5L202.1 93.2L203.1 93.7L204.9 92.9L206.2 93.3L209.8 91.5L208.4 93.5L206.5 94.4L205.6 96.3L206.3 96.7L184.7 144.8L182.2 147.6L182.7 150.1L185.4 152.8L186.2 155.5L185.3 156.7L185.4 158.6L183.3 161.3L184.5 164.7L184.1 167.1L182.9 169.1L183.2 170.4L182.7 171.6L184.0 171.8L183.2 172.6L146.3 172.8L144.7 171.4L144.0 172.2L143.3 172.0L143.0 173.4L141.6 173.7L141.1 172.8L140.0 172.8L139.2 170.3L138.3 170.1L138.2 170.9L137.5 170.5L137.2 167.9L136.0 167.3L135.3 167.8L133.5 165.3L133.4 164.3L131.6 163.0L122.6 162.8L120.9 167.0L119.7 166.7L118.9 167.2L118.5 169.0L119.1 170.1L118.4 170.2L117.9 171.8L116.7 171.9L116.5 174.7L114.6 175.2L114.5 174.3L111.2 175.4L108.5 175.1L107.6 175.7L107.4 178.3L105.5 180.4L104.5 180.3L103.8 178.3L102.2 179.3L101.5 179.0L101.6 180.8L99.7 180.2L97.5 182.2L95.4 180.2L90.3 180.1L90.5 181.2L89.2 182.8L86.1 184.2L85.7 185.0L63.4 175.2L44.4 164.9L17.9 158.7L4.6 152.5L6.4 148.3L12.3 145.2L12.6 144.1L11.0 140.9L11.2 139.6L14.4 135.0L14.4 132.8L15.5 130.5L15.2 129.2L16.1 128.5L18.2 127.8L21.0 125.7L21.2 124.9L24.0 123.9L26.9 121.4L29.9 120.8L30.1 121.6L31.4 121.0L31.2 120.6L33.4 120.7L34.0 119.8L34.7 119.8L34.8 120.3L37.1 119.8L37.1 119.3L37.8 119.8L39.3 117.4L40.8 117.6L41.1 116.7L41.4 117.5L42.3 116.8L42.8 117.6L43.6 116.8L44.7 117.4L44.9 117.0L45.2 118.7L45.7 118.5L46.4 119.6L47.4 118.4L48.2 119.4L49.1 118.8L55.6 83.6L55.7 80.8L55.4 79.2L53.0 76.2L53.7 74.9L53.2 73.3L49.6 71.2L48.0 69.4L48.2 60.5L50.9 60.3L52.4 59.1L53.2 59.6L54.7 58.4L56.1 59.8L58.9 59.4L58.1 58.4L58.7 56.7L57.2 54.4L52.3 54.3L52.0 53.7L50.5 54.2L50.5 46.5L53.9 45.7L55.7 46.5L70.1 46.4L68.8 45.3L69.5 43.7L70.2 43.4L72.6 45.2L74.6 42.7L76.3 42.9L78.7 40.2L79.5 40.7Z" fill={$v.mapa?.f?.AM} data-sel={$v.mapa?.s?.AM} data-dim={$v.mapa?.x?.AM} aria-label={$v.mapa?.l?.AM} onClick={$v.mapa?.c?.AM}></path>
                          {"\n              "}
                          <path className={"uf"} d="M266.0 16.9L266.8 19.9L268.0 20.5L267.9 26.5L268.7 30.7L270.8 35.5L270.6 37.3L271.2 37.1L271.6 37.8L272.4 41.5L275.3 40.8L277.7 45.6L281.4 46.7L281.7 52.9L279.4 58.8L275.8 59.7L272.8 65.0L269.7 66.4L267.9 68.2L266.4 68.6L261.0 76.6L260.8 80.0L259.5 81.1L257.8 81.2L257.5 80.7L256.5 82.0L255.9 81.0L252.4 79.8L252.7 77.7L252.0 77.2L251.1 77.5L251.3 74.3L249.9 74.2L249.2 72.7L249.3 70.8L247.5 69.0L246.5 68.9L243.7 62.6L244.5 59.0L241.0 56.0L240.4 53.7L241.1 53.3L240.8 52.3L239.5 52.6L239.5 51.1L238.2 51.2L238.2 50.3L235.9 50.5L234.0 49.0L233.1 49.3L232.5 47.5L231.9 47.7L230.6 46.3L225.5 45.9L225.4 43.6L224.7 42.4L225.3 40.8L224.0 38.1L226.2 37.8L226.5 39.3L227.2 39.1L229.1 40.7L232.0 41.0L234.4 40.4L236.8 38.6L237.1 39.4L239.5 40.1L241.8 39.0L243.1 40.0L242.5 40.5L242.4 40.8L242.6 41.2L244.6 40.6L246.4 41.2L250.9 37.0L250.9 35.6L252.9 32.3L253.5 29.1L255.1 27.6L258.2 21.8L261.4 18.7L262.5 14.1L263.2 14.1L266.0 16.9Z" fill={$v.mapa?.f?.AP} data-sel={$v.mapa?.s?.AP} data-dim={$v.mapa?.x?.AP} aria-label={$v.mapa?.l?.AP} onClick={$v.mapa?.c?.AP}></path>
                          {"\n              "}
                          <path className={"uf"} d="M404.7 170.0L405.3 171.7L407.6 172.0L408.6 172.8L410.3 172.7L411.4 173.5L411.8 174.9L412.4 175.0L413.2 173.1L414.2 173.6L413.6 174.6L414.0 175.2L416.2 175.5L415.9 176.9L417.2 180.2L419.6 181.2L419.1 182.4L419.7 183.0L419.1 183.8L420.0 185.0L419.6 186.2L421.6 187.2L422.7 191.2L421.2 192.3L421.8 195.5L419.6 196.4L418.9 195.7L417.1 195.7L416.9 198.2L418.4 199.4L418.9 201.2L419.9 201.5L419.9 203.9L421.2 204.3L421.8 205.4L423.2 206.0L423.6 205.4L425.2 205.8L427.2 204.5L424.0 211.1L419.0 218.8L415.6 222.6L413.9 223.4L412.8 223.2L413.1 222.2L412.5 222.4L412.0 223.5L408.4 226.6L409.3 228.6L408.8 229.9L409.3 230.9L408.0 232.1L408.8 234.5L407.3 243.7L408.7 255.1L409.7 257.5L407.8 262.2L407.9 263.7L406.4 268.3L406.7 269.9L405.5 273.2L405.8 278.1L406.4 279.5L404.9 281.7L402.9 282.5L401.4 284.3L400.2 287.4L393.8 283.0L393.4 282.3L394.4 281.4L393.8 280.0L389.2 276.1L390.1 274.6L389.8 271.9L390.7 269.8L393.2 270.0L393.4 268.9L392.4 268.6L393.2 266.1L394.6 266.2L395.3 264.3L395.6 264.7L396.5 263.0L397.4 262.6L398.1 260.6L397.4 259.2L396.4 259.2L395.4 258.0L394.4 258.1L393.7 256.8L392.1 257.1L391.1 256.2L389.9 256.8L388.3 255.2L387.5 255.8L387.0 255.0L386.2 255.5L385.3 255.0L383.2 256.5L381.0 256.1L380.7 253.2L375.5 248.4L372.2 249.4L371.2 248.2L370.2 248.7L368.1 247.9L362.4 243.7L359.6 243.0L356.6 243.9L355.5 245.0L354.9 244.2L351.4 243.0L352.6 239.3L347.6 238.0L343.5 239.3L340.4 241.2L340.3 242.2L337.5 244.2L336.1 244.1L333.2 246.6L331.9 246.5L330.1 248.5L327.4 248.9L326.0 250.4L325.5 249.5L326.3 249.2L327.3 246.8L326.3 245.2L327.1 241.7L326.7 240.2L327.6 240.2L327.9 239.4L326.1 237.5L323.8 236.4L324.4 235.3L323.8 234.5L324.2 233.4L323.6 232.8L324.3 232.4L323.9 231.4L325.0 230.3L324.1 229.9L324.5 228.8L324.1 228.4L326.4 226.6L323.8 227.4L323.2 226.8L323.1 224.4L325.5 222.2L323.3 222.6L323.6 218.2L325.1 217.0L323.9 217.1L323.9 216.3L322.8 215.2L322.3 211.7L324.9 210.0L322.5 209.6L323.2 206.8L325.9 206.8L321.3 205.4L319.7 202.7L321.4 201.5L322.3 199.1L323.6 198.1L324.0 196.3L324.6 195.8L324.4 195.0L328.9 192.4L328.9 191.6L329.9 191.3L330.4 190.4L330.1 189.1L331.5 188.5L333.9 192.6L333.3 193.3L333.4 194.6L335.6 197.1L337.6 197.3L339.3 198.3L342.3 196.3L342.3 195.4L343.4 194.7L344.2 195.0L346.2 193.8L347.0 194.7L348.5 194.8L349.7 192.2L351.0 192.3L352.8 188.2L353.6 188.1L354.0 187.2L353.4 186.2L354.1 185.3L352.5 184.3L351.8 181.8L356.0 178.4L358.4 180.3L360.3 179.7L362.0 180.1L362.3 181.4L364.4 182.6L364.9 181.6L367.5 181.1L370.4 178.7L375.1 178.1L376.4 175.4L378.5 174.7L380.4 171.7L383.5 171.6L383.4 172.2L384.6 173.3L385.7 173.2L387.1 176.4L388.7 177.1L387.4 180.6L389.2 181.0L391.5 179.4L392.5 179.4L393.5 175.9L394.9 176.5L396.9 175.8L397.9 174.4L397.6 173.2L400.2 172.6L400.0 171.1L403.3 169.7L404.7 170.0ZM401.3 284.2L401.4 284.3L401.4 284.2L401.3 284.2Z" fill={$v.mapa?.f?.BA} data-sel={$v.mapa?.s?.BA} data-dim={$v.mapa?.x?.BA} aria-label={$v.mapa?.l?.BA} onClick={$v.mapa?.c?.BA}></path>
                          {"\n              "}
                          <path className={"uf"} d="M396.2 101.2L405.1 105.9L411.9 111.3L414.1 111.7L419.4 118.2L422.3 120.0L424.3 122.7L427.4 123.6L428.3 125.2L423.8 126.3L420.7 133.2L418.6 135.3L419.1 136.0L417.7 138.5L416.1 140.2L414.4 140.2L412.9 142.6L412.6 143.9L413.5 143.9L413.6 144.1L411.8 147.6L412.5 148.6L410.7 150.1L410.7 151.1L411.8 151.8L411.6 153.5L413.4 154.7L412.0 158.0L408.7 160.3L408.4 161.3L407.8 161.0L407.0 161.5L406.4 159.9L404.5 159.2L404.3 157.7L400.3 154.9L393.6 156.4L392.7 155.7L390.1 155.9L390.7 152.6L391.7 151.3L391.5 149.6L392.1 148.8L387.9 147.0L387.2 145.3L387.4 143.1L385.9 139.7L385.7 129.4L383.3 127.8L381.9 125.6L382.4 124.5L381.9 124.3L382.8 123.2L382.0 122.1L383.8 117.2L383.2 116.7L383.5 115.7L381.9 115.6L382.3 114.5L381.3 113.1L382.1 111.7L380.9 111.4L380.5 110.0L381.4 109.1L379.9 107.6L381.9 104.3L381.1 102.3L389.6 101.3L390.6 100.6L396.2 101.2Z" fill={$v.mapa?.f?.CE} data-sel={$v.mapa?.s?.CE} data-dim={$v.mapa?.x?.CE} aria-label={$v.mapa?.l?.CE} onClick={$v.mapa?.c?.CE}></path>
                          {"\n              "}
                          <path className={"uf"} d="M388.0 317.3L385.3 322.8L383.8 321.8L381.6 322.1L376.5 320.7L376.6 317.7L374.6 316.3L375.5 314.9L374.9 314.6L375.6 312.9L374.9 311.7L376.1 309.7L380.4 309.5L381.3 306.6L382.7 305.9L382.9 303.3L384.4 302.0L384.3 301.0L385.4 300.9L385.9 298.9L385.5 296.9L384.1 295.8L384.6 294.9L382.0 293.4L382.1 292.8L383.7 293.3L385.8 293.0L385.5 291.4L384.2 290.7L384.6 288.7L382.7 288.5L383.0 286.9L384.2 285.2L386.1 284.5L387.5 285.1L386.0 283.0L386.2 282.8L387.0 282.6L388.3 283.5L390.3 281.9L393.8 283.0L400.3 287.2L399.3 293.3L400.0 298.9L398.7 303.0L396.6 304.1L394.8 306.6L394.1 309.8L393.0 310.7L393.3 311.2L391.5 314.8L391.1 314.7L389.1 317.3L388.9 316.6L388.0 317.3ZM390.3 315.2L390.3 315.2L390.6 315.2L390.3 315.2ZM390.2 315.3L390.4 315.5L390.4 315.4L390.2 315.3Z" fill={$v.mapa?.f?.ES} data-sel={$v.mapa?.s?.ES} data-dim={$v.mapa?.x?.ES} aria-label={$v.mapa?.l?.ES} onClick={$v.mapa?.c?.ES}></path>
                          {"\n              "}
                          <path className={"uf"} d="M278.7 216.1L277.8 217.6L278.3 218.0L277.0 219.4L277.1 221.3L281.5 222.8L287.8 226.5L288.2 224.0L290.7 220.7L291.2 222.0L292.4 222.7L293.9 220.9L295.2 223.1L296.7 223.9L296.9 227.0L297.8 224.7L298.6 226.7L301.7 225.0L301.8 226.9L303.0 226.0L304.1 227.0L305.7 226.9L307.4 228.8L308.1 227.6L307.5 225.7L307.9 224.4L308.8 224.7L308.8 225.4L309.7 225.4L310.3 226.7L310.9 226.0L312.0 226.4L312.6 225.5L315.5 224.8L318.2 222.8L321.6 222.8L322.0 221.1L322.6 221.6L322.7 223.1L325.5 222.2L323.1 224.4L323.6 227.4L326.4 226.6L324.1 228.4L324.5 228.8L324.1 229.9L325.0 230.3L323.9 231.4L324.3 232.4L323.6 232.8L324.2 233.4L323.8 234.5L324.4 235.3L323.8 236.4L326.1 237.5L327.9 239.4L327.6 240.2L326.7 240.2L327.1 241.7L326.8 244.7L325.9 246.4L323.5 246.3L323.1 245.0L321.0 243.6L320.3 244.6L321.0 247.8L319.6 248.3L316.9 247.3L316.2 247.9L316.6 248.5L316.0 250.0L317.2 251.1L315.9 253.8L317.0 254.6L317.5 257.8L314.3 258.7L313.6 258.3L311.6 259.6L310.9 259.0L310.9 257.8L311.6 254.3L310.4 253.2L301.4 253.2L300.9 255.7L301.3 256.1L300.4 257.3L300.5 259.8L311.8 259.9L311.2 260.8L311.5 262.0L310.0 265.2L312.4 267.2L313.0 270.1L313.8 271.0L311.2 273.2L310.2 275.4L309.4 275.2L309.0 276.6L309.6 277.5L311.4 277.5L312.2 278.5L311.0 281.2L312.0 283.9L309.1 286.0L308.7 285.6L308.0 287.2L304.2 289.2L303.9 288.5L300.7 287.2L300.1 287.8L297.2 287.1L294.2 287.8L292.8 286.9L291.2 288.2L289.7 288.1L287.7 290.9L285.9 289.1L284.7 290.4L283.0 290.9L280.3 290.4L279.6 291.3L276.9 291.6L274.6 294.4L274.3 296.4L272.7 296.9L271.0 298.7L270.4 300.3L270.7 301.2L268.6 300.0L267.9 298.9L264.0 297.2L261.3 296.8L258.0 294.8L256.4 294.6L255.2 293.4L253.5 293.1L252.1 291.5L246.7 290.9L246.2 289.7L248.5 287.4L244.6 286.9L244.1 284.2L244.9 283.0L243.0 279.8L242.9 277.6L243.2 274.8L245.1 272.0L245.6 269.5L248.2 268.1L249.0 266.9L248.8 266.3L250.1 265.6L250.3 264.8L249.3 264.0L249.4 262.8L251.0 262.3L251.2 260.9L253.5 260.0L254.4 257.9L257.2 257.8L257.9 256.9L258.7 257.1L260.1 254.9L259.9 253.6L260.5 253.8L260.8 253.0L261.4 249.4L262.7 248.0L265.0 246.9L266.1 247.6L267.9 246.2L269.3 241.5L269.2 238.7L269.9 236.6L270.8 236.3L270.4 232.0L271.2 231.5L271.7 229.6L273.5 226.9L273.4 224.0L274.4 222.9L275.0 219.7L276.3 217.7L278.7 216.1Z" fill={$v.mapa?.f?.GO} data-sel={$v.mapa?.s?.GO} data-dim={$v.mapa?.x?.GO} aria-label={$v.mapa?.l?.GO} onClick={$v.mapa?.c?.GO}></path>
                          {"\n              "}
                          <path className={"uf"} d="M314.5 176.0L315.0 175.0L315.1 174.9L315.1 174.6L315.6 174.2L315.4 173.7L316.3 173.4L316.3 170.3L317.5 168.0L320.6 167.0L321.5 164.0L319.9 161.9L314.8 163.8L309.4 156.4L308.4 156.5L309.7 155.6L309.5 154.7L308.5 154.4L307.8 154.8L306.6 153.6L309.1 150.9L310.9 142.4L309.5 133.5L306.7 131.8L305.5 131.7L305.0 130.3L301.6 130.3L299.5 129.2L297.4 129.7L296.7 131.2L295.8 130.9L294.9 131.4L306.1 122.2L307.4 122.5L308.2 121.9L309.8 119.0L311.0 118.1L311.6 115.8L314.3 113.5L314.8 110.0L315.9 108.9L315.9 107.7L317.4 106.9L318.2 104.6L319.0 104.3L319.0 101.8L320.2 101.3L319.2 99.5L321.0 98.6L321.2 97.6L322.0 97.5L322.1 95.6L321.5 95.7L321.9 94.1L323.6 93.0L324.4 89.2L323.1 88.4L325.1 87.3L324.8 84.9L325.7 83.2L325.1 81.9L326.2 80.8L326.4 81.3L326.7 80.0L327.3 79.8L326.9 81.1L327.5 80.9L327.5 82.1L328.7 79.7L327.9 81.3L328.5 81.0L328.0 81.9L328.6 81.7L328.3 82.3L328.5 82.6L329.0 81.2L329.2 81.9L328.7 82.6L329.5 82.5L329.9 80.8L330.6 80.9L329.8 82.0L330.4 82.4L330.4 82.9L330.1 83.0L330.1 83.1L330.0 83.4L330.6 83.3L330.3 83.4L329.9 83.8L330.3 83.5L330.1 84.0L331.2 83.6L331.7 82.3L331.6 82.9L332.4 82.4L332.0 82.7L331.9 83.1L332.1 83.4L332.7 82.7L332.4 83.5L332.6 83.7L332.4 84.0L332.5 84.1L333.7 82.7L332.8 84.4L333.2 85.4L332.8 85.6L333.3 85.7L333.3 84.6L333.6 84.2L333.5 84.8L333.8 85.0L334.2 83.6L334.6 83.5L334.3 83.0L334.8 83.0L335.1 84.3L334.0 85.0L334.5 84.8L334.1 85.8L334.6 84.9L335.0 85.1L334.4 88.0L334.9 86.4L335.6 86.7L336.8 84.8L337.0 85.5L337.0 84.7L337.3 84.1L337.3 84.0L337.2 83.9L337.2 83.8L337.1 83.8L337.3 83.5L337.4 83.6L337.3 84.3L337.3 85.1L337.4 85.2L337.3 85.3L337.4 85.4L337.4 85.2L337.4 85.2L337.3 84.9L337.6 85.0L337.7 84.9L337.7 84.7L337.6 84.6L337.7 84.6L337.7 84.7L337.7 85.2L337.6 85.4L339.1 84.9L339.2 85.0L339.0 85.1L339.0 85.2L339.0 85.3L339.1 85.4L340.6 84.2L339.6 86.6L340.5 86.1L341.0 86.7L340.8 87.1L341.1 86.8L341.0 86.2L341.3 86.7L342.0 85.8L341.7 86.5L342.2 86.0L342.6 86.7L342.4 87.2L341.9 86.9L341.0 87.2L340.9 88.2L341.1 87.7L342.0 88.1L340.6 89.0L342.4 88.1L342.5 88.7L342.5 87.8L343.2 88.1L342.7 88.7L342.7 89.1L343.1 89.4L342.6 89.5L343.3 89.5L343.4 88.8L343.3 89.5L343.9 89.3L343.1 90.0L344.0 89.8L344.4 90.5L344.3 92.9L345.5 93.8L345.9 95.3L345.3 96.2L346.3 97.2L349.8 96.0L349.8 96.6L349.2 96.4L348.9 96.8L350.5 97.0L350.3 98.1L351.7 95.9L352.5 95.3L353.0 95.7L353.2 94.7L354.5 93.8L355.9 95.7L357.2 95.1L359.5 95.7L364.0 97.9L364.6 97.9L365.2 99.0L365.0 97.9L367.7 99.7L370.6 99.2L372.7 99.5L373.0 100.3L373.2 99.8L375.3 99.8L374.8 101.7L375.6 102.8L373.9 105.4L371.9 106.3L372.1 106.9L370.9 108.4L367.9 109.0L367.5 108.6L365.4 111.3L364.8 114.1L361.8 118.0L362.1 119.7L363.4 121.0L362.2 123.5L362.2 124.7L363.3 126.4L364.0 129.4L363.7 131.4L360.5 134.8L360.8 139.9L363.2 142.0L363.6 143.2L362.6 147.2L361.6 148.2L358.8 148.4L356.8 149.3L353.3 147.6L349.7 148.3L349.2 149.1L348.7 148.9L346.5 152.6L343.5 153.9L342.1 155.9L340.6 155.5L339.3 156.8L334.5 158.2L333.2 159.2L329.6 170.5L327.6 172.5L326.9 174.3L328.1 179.3L329.4 181.0L328.7 181.9L328.7 186.5L327.5 190.3L326.8 190.3L326.5 189.3L325.0 189.7L322.6 189.2L321.6 187.8L321.2 185.1L319.4 184.0L320.6 181.9L320.4 181.0L319.2 179.9L318.0 180.1L316.2 176.0L314.5 176.0ZM340.6 88.8L340.7 88.9L340.7 88.8L340.6 88.8ZM343.5 90.2L343.5 90.3L343.5 90.2L343.5 90.2ZM329.8 83.7L329.7 83.7L329.8 83.7L329.8 83.7ZM328.2 81.4L328.2 81.4L328.3 81.3L328.2 81.4ZM329.0 82.8L329.0 82.9L329.0 82.8L329.0 82.8ZM342.0 89.0L342.1 88.9L342.0 88.9L342.0 89.0ZM333.9 87.5L333.9 87.5L334.0 87.4L333.9 87.5ZM340.8 86.7L340.8 86.7L340.9 86.6L340.8 86.7ZM337.0 85.7L337.0 85.8L337.2 85.7L337.0 85.7ZM328.9 82.2L329.0 81.9L328.9 82.1L328.9 82.2ZM331.8 83.2L331.8 83.3L331.8 83.2L331.8 83.2ZM329.2 83.1L329.2 83.3L329.2 83.3L329.2 83.1ZM340.4 89.1L340.2 89.1L340.5 89.1L340.4 89.1ZM334.2 84.3L334.3 84.3L334.1 84.3L334.2 84.3ZM328.1 82.1L328.0 82.1L328.0 82.2L328.0 82.3L328.1 82.1ZM331.6 83.1L331.7 83.1L331.6 82.9L331.6 83.1ZM333.8 86.1L334.1 85.7L334.0 85.6L333.8 86.1Z" fill={$v.mapa?.f?.MA} data-sel={$v.mapa?.s?.MA} data-dim={$v.mapa?.x?.MA} aria-label={$v.mapa?.l?.MA} onClick={$v.mapa?.c?.MA}></path>
                          {"\n              "}
                          <path className={"uf"} d="M347.6 238.1L352.6 239.3L351.4 243.0L354.9 244.2L355.5 245.0L356.6 243.9L359.6 243.0L362.4 243.7L368.1 247.9L370.2 248.7L371.2 248.2L372.2 249.4L375.5 248.4L380.7 253.2L381.0 256.1L383.2 256.5L385.3 255.0L386.2 255.5L387.0 255.0L387.5 255.8L388.2 255.2L389.9 256.8L391.1 256.2L392.1 257.1L393.7 256.8L394.4 258.1L395.4 258.0L396.4 259.2L397.4 259.2L398.1 260.6L397.4 262.6L396.5 263.0L395.6 264.7L395.3 264.3L394.6 266.2L393.2 266.1L392.4 268.6L393.4 268.9L393.2 270.0L390.9 269.7L389.8 271.9L390.1 274.6L389.2 276.1L393.8 280.0L394.4 281.4L393.4 282.3L393.8 283.0L390.3 281.9L388.3 283.5L387.0 282.6L386.2 282.8L387.5 285.1L386.1 284.5L384.2 285.2L383.0 286.9L382.7 288.5L384.6 288.7L384.2 290.7L385.5 291.4L385.8 293.0L383.7 293.3L382.1 292.8L382.0 293.4L384.6 294.9L384.0 295.5L385.7 297.5L385.5 300.7L385.2 301.3L384.3 301.0L384.4 302.0L382.9 303.3L382.7 305.9L381.3 306.6L380.4 309.5L376.1 309.7L375.0 311.1L375.6 312.4L374.9 314.6L375.5 314.9L373.5 318.4L371.5 318.9L372.3 319.6L370.8 321.3L371.0 322.2L369.8 324.7L370.3 325.1L369.0 326.6L370.1 327.8L363.0 330.7L360.8 332.3L360.1 332.5L360.1 331.6L358.8 331.3L355.1 332.2L352.8 331.9L347.3 334.4L344.8 334.3L342.4 335.7L337.4 337.0L333.9 339.0L333.0 338.3L332.2 339.0L331.7 339.0L331.8 338.4L330.8 339.0L330.8 338.1L330.2 338.1L330.4 339.0L329.0 339.9L330.0 339.9L330.2 341.0L329.7 340.7L329.3 341.5L328.2 341.7L327.9 341.0L325.3 342.3L325.2 341.5L322.9 342.1L322.4 341.6L323.0 340.3L321.3 339.6L322.3 339.1L322.2 337.7L319.1 336.2L318.5 334.9L319.1 333.3L319.9 332.8L318.5 332.1L319.8 331.3L318.9 329.2L319.7 327.3L320.9 326.5L321.0 324.8L319.7 324.5L319.2 323.5L318.7 324.1L318.0 323.5L315.2 324.3L313.6 319.0L312.5 317.8L314.2 314.9L313.5 313.4L311.9 312.6L312.3 309.2L310.2 307.8L309.9 306.8L307.9 307.8L307.1 307.0L305.3 307.1L304.9 308.7L304.0 307.6L303.5 308.6L302.4 308.9L300.9 307.5L300.8 308.9L294.2 309.1L293.3 312.5L292.5 311.9L292.2 309.2L291.3 309.0L290.6 310.6L289.6 310.8L288.5 308.4L289.2 306.8L287.0 307.0L285.7 306.1L281.8 306.5L276.4 305.6L275.0 304.6L268.9 308.2L268.4 303.9L269.1 302.3L269.8 302.1L269.4 301.0L270.9 301.0L270.4 300.3L271.0 298.7L272.7 296.9L274.3 296.4L274.6 294.4L276.9 291.6L279.6 291.3L280.3 290.4L283.0 290.9L284.7 290.4L285.9 289.1L287.7 290.9L289.7 288.1L291.2 288.2L292.8 286.9L294.2 287.8L297.2 287.1L300.1 287.8L300.7 287.2L303.9 288.5L304.2 289.2L308.0 287.2L308.7 285.6L309.1 286.0L312.0 283.9L311.0 281.2L312.2 278.5L311.4 277.5L309.5 277.5L309.0 275.9L309.4 275.2L310.2 275.4L311.2 273.2L313.8 271.0L313.0 270.1L312.4 267.2L310.0 265.2L311.5 262.0L311.2 260.8L311.8 259.4L312.7 259.4L313.6 258.3L314.3 258.7L317.5 257.8L317.0 254.6L315.9 253.8L317.2 251.1L316.0 250.0L316.6 248.5L316.2 247.8L316.9 247.3L319.6 248.3L321.0 247.8L320.3 244.6L321.4 243.7L323.1 245.0L323.5 246.3L326.8 246.0L327.2 247.7L325.5 249.5L326.3 250.3L327.4 248.9L330.1 248.5L331.9 246.5L333.2 246.6L336.1 244.1L337.5 244.2L340.3 242.2L340.4 241.2L343.5 239.3L347.6 238.1Z" fill={$v.mapa?.f?.MG} data-sel={$v.mapa?.s?.MG} data-dim={$v.mapa?.x?.MG} aria-label={$v.mapa?.l?.MG} onClick={$v.mapa?.c?.MG}></path>
                          {"\n              "}
                          <path className={"uf"} d="M234.7 281.8L237.7 283.4L238.6 282.9L240.3 283.7L240.7 283.0L244.9 283.7L244.1 284.2L244.9 287.3L246.3 286.8L248.5 287.4L246.2 289.7L246.7 290.9L248.6 291.5L251.2 291.1L253.5 293.1L255.2 293.4L257.1 295.0L258.0 294.8L261.3 296.8L264.0 297.2L268.2 299.1L269.6 300.7L269.8 301.9L268.4 303.9L268.9 308.3L268.1 310.2L264.9 311.5L262.1 314.8L261.7 318.4L258.8 320.8L258.9 323.4L257.7 325.2L256.4 325.4L256.4 327.8L253.7 330.6L252.6 332.9L245.8 337.1L243.4 339.9L238.7 342.6L237.3 347.0L234.3 348.7L232.6 355.0L230.8 356.0L229.1 354.1L226.4 352.9L223.2 354.8L218.5 355.1L217.5 354.5L217.5 351.8L216.3 350.7L216.5 345.6L215.6 345.0L214.8 341.4L215.4 339.1L212.7 334.6L208.5 334.5L206.8 333.2L206.4 332.1L205.1 332.3L203.6 334.3L202.8 333.8L201.2 334.8L199.4 333.9L195.1 334.0L192.7 333.3L192.3 332.3L190.1 333.0L187.9 332.3L188.8 329.7L188.1 329.4L188.8 328.7L188.4 328.1L189.1 327.5L188.2 325.5L189.5 323.3L188.7 322.6L189.5 321.8L189.3 319.7L189.9 318.5L188.6 318.0L189.4 317.1L188.2 316.7L189.4 316.1L188.7 315.2L188.0 315.6L187.8 312.4L186.8 311.7L186.7 310.3L185.9 310.3L186.4 309.5L185.8 309.3L189.4 306.8L186.3 304.3L190.3 295.6L191.3 295.3L191.0 294.0L190.5 294.0L192.9 286.1L194.1 286.0L192.7 284.8L190.2 277.9L191.1 277.7L191.4 279.8L194.1 282.0L195.0 281.1L198.9 280.0L199.6 278.2L200.8 277.6L201.4 275.9L202.5 274.9L203.5 275.3L205.1 274.6L205.8 275.2L209.7 273.2L211.7 274.5L215.1 275.3L216.5 277.0L219.2 277.7L221.1 279.0L224.2 278.7L227.4 276.8L228.6 277.0L229.7 278.1L229.7 278.8L230.6 279.1L233.3 278.6L233.7 277.0L237.5 273.9L237.6 279.1L235.4 280.2L234.7 281.8Z" fill={$v.mapa?.f?.MS} data-sel={$v.mapa?.s?.MS} data-dim={$v.mapa?.x?.MS} aria-label={$v.mapa?.l?.MS} onClick={$v.mapa?.c?.MS}></path>
                          {"\n              "}
                          <path className={"uf"} d="M160.4 226.8L161.5 224.9L161.3 224.2L163.6 222.0L163.8 218.6L165.4 217.0L166.3 216.9L167.2 215.3L165.8 214.1L164.8 210.2L163.3 209.3L163.3 206.3L165.5 204.0L164.9 200.7L161.1 199.9L160.6 200.5L159.3 199.1L146.6 199.0L147.1 196.7L147.5 196.8L147.7 192.2L146.1 189.1L147.1 185.5L146.4 183.8L147.5 182.7L145.7 178.4L146.9 178.1L146.6 176.3L147.6 174.2L146.3 172.8L183.0 172.7L184.0 171.8L182.7 171.6L184.5 164.7L183.3 161.3L185.4 158.6L185.3 156.7L186.2 155.4L188.1 157.6L189.8 162.9L191.9 165.8L191.4 168.2L192.5 172.3L194.4 172.6L195.0 173.8L197.1 174.4L198.9 176.4L198.7 177.4L201.5 178.2L202.1 180.1L203.2 179.6L277.9 185.3L276.0 188.8L275.7 191.5L273.5 195.1L273.4 200.0L271.9 204.4L271.9 205.7L272.9 206.4L272.1 208.1L273.1 209.8L272.5 213.6L273.3 216.3L272.3 218.5L273.0 219.0L273.3 221.0L273.8 220.8L274.7 221.8L273.4 224.0L273.5 226.9L271.7 229.6L271.2 231.5L270.4 232.0L270.8 236.3L269.9 236.6L269.2 238.7L269.3 241.5L267.9 246.2L266.1 247.6L265.0 246.9L262.7 248.0L261.4 249.4L260.8 253.0L260.5 253.8L259.9 253.6L260.1 254.9L258.7 257.1L257.9 256.9L257.2 257.8L254.4 257.9L253.5 260.0L251.2 260.9L251.0 262.3L249.4 262.8L249.3 264.0L250.3 264.8L250.0 265.8L248.8 266.3L249.0 266.9L248.2 268.1L245.6 269.5L245.1 272.0L243.2 274.8L242.9 279.5L243.8 280.4L244.9 283.7L240.7 283.0L240.3 283.7L238.6 282.9L237.7 283.4L234.7 282.3L235.8 279.6L237.6 279.1L237.5 273.9L233.7 277.0L233.2 278.6L230.3 279.1L228.6 277.0L227.4 276.8L224.2 278.7L221.1 279.0L219.2 277.7L216.5 277.0L215.1 275.3L211.7 274.5L209.7 273.2L205.8 275.2L205.1 274.6L203.5 275.3L202.5 274.9L201.4 275.9L200.8 277.6L199.6 278.2L198.9 280.0L195.0 281.1L194.1 282.0L191.4 279.8L190.9 277.6L190.7 278.0L189.1 276.6L187.3 277.1L183.2 273.4L182.3 270.4L182.3 267.6L183.9 265.1L184.1 262.4L182.8 263.0L162.6 262.4L161.8 252.9L158.1 248.5L161.8 248.4L161.4 242.6L160.9 242.5L158.9 237.5L160.2 235.0L158.9 233.5L159.2 232.7L156.3 231.4L157.3 230.1L160.1 228.7L160.4 226.8Z" fill={$v.mapa?.f?.MT} data-sel={$v.mapa?.s?.MT} data-dim={$v.mapa?.x?.MT} aria-label={$v.mapa?.l?.MT} onClick={$v.mapa?.c?.MT}></path>
                          {"\n              "}
                          <path className={"uf"} d="M315.8 76.0L315.5 76.5L315.8 77.5L316.2 77.7L317.1 76.0L317.0 77.6L317.4 77.1L317.7 78.0L318.0 77.0L318.2 78.2L318.5 77.1L319.1 77.5L318.9 76.9L319.5 76.7L319.8 77.3L319.4 77.6L319.5 78.3L318.9 78.6L319.0 78.9L320.1 78.9L320.5 78.0L320.6 78.9L321.0 77.8L321.9 77.5L321.1 78.9L321.4 79.8L322.1 79.4L322.1 79.7L321.9 79.8L321.9 80.0L322.1 79.9L322.1 79.4L322.0 79.3L322.0 79.2L322.3 79.0L322.5 79.8L322.9 79.2L322.8 80.1L323.3 80.2L323.0 79.9L323.2 79.4L323.4 79.9L323.6 79.8L323.3 79.3L323.8 79.1L323.8 78.2L324.7 77.9L323.9 79.2L324.4 79.0L324.5 79.7L323.8 80.7L323.7 81.3L324.9 79.1L324.5 80.8L324.9 81.1L325.0 80.2L325.1 80.8L325.2 80.0L326.0 79.4L325.7 80.0L325.7 81.5L325.0 82.5L325.7 83.2L324.8 84.9L325.1 87.3L323.1 88.4L324.4 89.2L323.6 93.0L321.9 94.1L321.5 95.7L322.1 95.6L322.0 97.5L321.2 97.6L321.0 98.6L319.2 99.5L320.2 101.3L319.0 101.8L319.0 104.3L318.2 104.6L317.4 106.9L315.9 107.7L315.9 108.9L314.8 110.0L314.3 113.5L311.6 115.8L311.0 118.1L309.8 119.0L308.5 121.4L307.4 122.5L306.1 122.2L294.9 131.4L296.8 132.3L299.2 131.9L300.2 133.5L302.1 134.4L301.7 135.7L300.3 136.3L301.0 138.5L299.8 139.2L300.3 140.4L298.7 141.3L299.3 143.8L297.9 143.4L296.6 144.6L296.0 147.1L294.3 148.2L291.9 148.6L289.7 150.3L290.0 154.0L287.6 157.7L288.4 159.4L290.4 160.8L289.6 165.5L288.8 167.7L287.7 168.7L285.2 173.3L283.5 174.1L280.1 178.7L277.9 185.3L203.2 179.6L202.2 180.1L201.5 178.2L198.7 177.4L198.9 176.4L197.1 174.4L195.0 173.8L194.4 172.6L192.5 172.3L191.4 168.2L191.9 165.8L189.8 162.9L189.0 159.3L187.1 156.0L185.8 155.0L185.4 152.8L182.7 150.1L182.2 147.6L184.7 144.8L206.3 96.7L205.6 96.3L206.5 94.4L208.4 93.5L209.8 91.5L206.2 93.3L204.9 92.9L203.1 93.7L202.1 93.2L202.5 91.5L201.0 91.4L198.9 90.1L198.6 88.9L197.5 87.8L194.8 87.9L194.7 87.3L193.2 87.0L192.4 86.0L191.5 86.3L191.1 85.2L188.2 84.0L187.6 80.5L185.9 82.0L182.8 79.5L182.7 77.8L179.6 75.3L179.4 72.5L177.7 71.3L177.4 52.5L178.3 53.1L179.2 52.8L179.6 51.7L182.0 52.0L182.5 50.7L181.9 49.6L183.3 49.6L184.0 48.0L185.9 48.5L186.3 49.2L187.7 49.2L187.9 47.3L190.4 46.4L193.1 46.8L194.3 44.3L195.8 43.2L196.7 43.9L198.4 42.9L199.2 44.2L200.3 44.0L201.8 45.0L202.6 44.1L205.7 43.7L211.5 45.1L212.1 44.5L212.1 42.7L210.3 41.0L210.5 40.5L209.4 40.0L209.9 38.7L210.7 39.1L211.2 36.9L214.2 38.4L218.1 38.2L218.8 37.0L223.1 36.2L225.3 40.8L224.7 42.4L225.4 43.6L225.5 45.9L230.6 46.3L231.9 47.7L232.5 47.5L233.1 49.3L234.0 49.0L235.9 50.5L238.2 50.3L238.2 51.2L239.5 51.1L239.5 52.6L240.8 52.3L241.1 53.3L240.4 53.7L241.0 56.0L244.5 59.0L243.7 62.6L246.5 68.9L247.5 69.0L249.3 70.8L249.2 72.7L249.9 74.2L251.3 74.3L251.1 77.5L252.0 77.2L252.7 77.7L252.4 79.8L255.9 81.0L256.2 81.9L256.7 82.0L257.5 80.7L257.8 81.2L259.5 81.1L260.8 80.0L261.0 76.6L266.4 68.6L267.9 68.2L269.7 66.4L272.8 65.0L274.1 63.5L275.5 60.0L278.7 58.7L279.4 58.8L280.0 60.3L279.8 63.1L283.5 63.3L284.2 62.8L287.5 67.0L292.9 69.9L298.9 70.3L299.2 71.6L298.2 73.2L303.8 75.7L304.9 73.8L305.5 74.2L305.2 75.3L305.5 75.4L305.7 75.2L305.8 73.9L306.4 74.8L307.1 73.6L308.0 75.6L308.6 74.2L309.0 74.5L309.6 76.4L310.1 74.3L310.4 75.1L311.5 74.3L311.9 74.9L312.8 74.8L312.5 75.7L313.4 75.2L313.3 76.5L314.3 75.1L314.6 76.9L314.8 75.9L315.8 76.0Z" fill={$v.mapa?.f?.PA} data-sel={$v.mapa?.s?.PA} data-dim={$v.mapa?.x?.PA} aria-label={$v.mapa?.l?.PA} onClick={$v.mapa?.c?.PA}></path>
                          {"\n              "}
                          <path className={"uf"} d="M425.9 140.9L429.2 139.8L429.4 141.0L426.8 143.3L426.6 145.4L425.6 145.8L425.6 147.7L427.9 147.5L428.5 149.1L431.2 147.7L431.7 148.7L433.1 148.0L434.3 149.2L433.9 150.4L434.5 151.0L436.9 149.0L436.3 147.7L436.7 146.4L437.7 146.7L436.7 144.6L437.0 143.5L437.8 143.5L438.2 142.7L439.5 142.9L439.9 144.4L441.9 144.1L443.0 145.1L446.7 144.5L452.4 145.9L454.7 145.0L455.1 148.2L456.1 150.0L456.1 150.8L455.9 150.9L455.9 151.3L456.1 151.5L456.3 150.8L456.8 153.0L456.4 157.8L454.8 157.7L453.5 156.0L451.6 155.7L449.5 156.9L448.8 156.5L448.2 159.1L442.8 161.0L440.3 160.4L439.7 161.2L437.9 161.0L437.6 162.2L436.4 162.0L435.7 162.6L435.5 164.5L431.3 166.8L429.3 165.2L429.0 162.7L427.1 162.9L428.4 161.0L429.4 160.6L429.2 158.2L431.4 157.0L430.9 155.9L428.5 154.5L425.4 155.6L425.0 156.9L423.0 157.8L422.6 159.1L421.2 159.0L419.9 160.5L419.1 160.2L418.7 161.2L417.7 160.6L416.3 161.2L415.5 159.3L412.7 160.2L411.3 158.5L413.4 154.7L411.6 153.5L411.8 151.8L410.7 151.1L410.7 150.1L412.5 148.6L411.8 147.6L413.6 144.1L412.6 143.9L414.3 143.2L414.0 144.0L416.3 145.3L418.3 145.5L422.4 142.7L422.5 141.5L425.9 140.9Z" fill={$v.mapa?.f?.PB} data-sel={$v.mapa?.s?.PB} data-dim={$v.mapa?.x?.PB} aria-label={$v.mapa?.l?.PB} onClick={$v.mapa?.c?.PB}></path>
                          {"\n              "}
                          <path className={"uf"} d="M428.0 154.5L430.9 155.9L431.4 157.0L429.2 158.2L429.4 160.6L428.4 161.0L427.1 162.9L429.0 162.7L429.3 165.2L431.3 166.8L435.5 164.5L435.7 162.6L436.4 162.0L437.6 162.2L437.9 161.0L439.7 161.2L440.3 160.4L442.8 161.0L448.2 159.1L448.8 156.5L449.5 156.9L451.6 155.7L453.5 156.0L454.8 157.7L456.2 157.7L456.3 163.3L452.6 174.2L449.0 173.0L445.7 174.2L445.2 173.4L444.0 173.4L441.3 174.7L441.5 175.4L439.7 176.4L440.2 177.2L437.7 177.7L435.8 179.3L434.7 178.5L432.7 178.4L431.7 179.8L430.0 178.1L429.3 178.5L428.9 177.8L428.5 178.1L427.5 176.3L425.8 175.5L425.5 174.8L423.1 175.1L422.4 173.5L419.8 177.0L418.5 177.3L416.9 179.2L415.9 176.9L416.2 175.5L414.0 175.2L413.6 174.6L414.0 173.4L413.0 173.2L412.2 175.0L410.3 172.7L408.6 172.8L407.6 172.0L405.4 171.7L404.7 170.0L403.6 169.6L400.0 171.1L400.0 172.8L397.6 173.2L397.9 174.4L396.9 175.8L394.9 176.5L393.5 175.9L392.5 179.4L391.5 179.4L389.2 181.0L387.4 180.6L388.7 177.1L386.9 176.2L385.7 173.2L384.6 173.3L383.4 172.2L383.5 171.6L381.6 172.0L380.7 171.7L382.3 170.9L384.8 168.0L385.7 168.6L386.1 167.5L386.7 167.8L387.3 166.3L389.6 164.9L390.1 161.2L388.6 160.3L389.0 158.5L388.2 156.9L390.1 155.9L392.7 155.7L393.6 156.4L400.3 154.9L404.3 157.7L404.5 159.2L406.4 159.9L407.0 161.5L407.8 161.0L408.4 161.3L408.7 160.3L411.3 158.7L412.7 160.2L415.5 159.3L416.3 161.2L417.7 160.6L418.7 161.2L419.1 160.2L419.9 160.5L421.2 159.0L422.6 159.1L423.0 157.8L425.0 156.9L425.4 155.6L428.0 154.5Z" fill={$v.mapa?.f?.PE} data-sel={$v.mapa?.s?.PE} data-dim={$v.mapa?.x?.PE} aria-label={$v.mapa?.l?.PE} onClick={$v.mapa?.c?.PE}></path>
                          {"\n              "}
                          <path className={"uf"} d="M375.4 100.1L378.0 102.1L381.1 102.3L381.8 103.3L381.9 104.3L379.9 107.6L381.4 109.1L380.5 110.0L380.9 111.4L382.1 111.7L381.3 113.1L382.3 114.5L381.9 115.6L383.5 115.7L383.2 116.7L383.8 117.2L382.0 122.1L382.8 123.2L381.9 124.3L382.4 124.5L381.9 125.6L383.3 127.8L385.7 129.4L385.9 139.7L387.4 143.1L387.2 145.3L387.9 147.0L392.1 148.8L391.5 149.6L391.7 151.3L390.7 152.6L390.1 155.9L388.2 156.9L389.0 158.5L388.6 160.3L390.1 161.2L389.6 164.9L387.3 166.3L386.9 167.5L386.1 167.5L385.7 168.6L384.8 168.0L382.3 170.9L380.4 171.7L378.5 174.7L376.4 175.4L375.1 178.1L370.4 178.7L367.5 181.1L364.9 181.6L364.4 182.6L362.3 181.4L362.0 180.1L360.3 179.7L358.4 180.3L356.0 178.4L351.8 181.8L352.5 184.3L354.1 185.3L353.4 186.2L354.0 187.2L353.6 188.1L352.8 188.2L351.0 192.3L349.7 192.2L348.5 194.8L347.0 194.7L346.2 193.8L344.2 195.0L343.4 194.7L342.3 195.4L342.3 196.3L339.3 198.3L337.6 197.3L335.6 197.1L333.4 194.6L333.3 193.3L333.9 192.6L331.7 188.7L330.0 189.1L329.3 190.4L327.5 190.3L327.4 189.8L328.3 188.5L328.7 181.9L329.4 181.0L328.1 179.3L326.9 174.3L327.6 172.5L329.6 170.5L330.0 168.1L331.7 165.1L332.7 160.2L334.5 158.2L339.3 156.8L340.6 155.5L342.1 155.9L343.5 153.9L346.5 152.6L349.4 148.4L353.3 147.6L356.8 149.3L358.8 148.4L361.6 148.2L362.6 147.2L363.6 143.2L363.2 142.0L360.8 139.9L360.5 134.8L363.7 131.4L364.0 129.4L363.3 126.4L362.2 124.7L362.2 123.5L363.4 121.0L362.1 119.7L361.8 118.0L364.8 114.1L365.4 111.3L367.5 108.6L367.9 109.0L370.9 108.4L372.1 106.8L371.7 106.6L373.2 106.1L375.3 103.5L375.0 100.5L375.4 100.1Z" fill={$v.mapa?.f?.PI} data-sel={$v.mapa?.s?.PI} data-dim={$v.mapa?.x?.PI} aria-label={$v.mapa?.l?.PI} onClick={$v.mapa?.c?.PI}></path>
                          {"\n              "}
                          <path className={"uf"} d="M255.9 337.4L262.4 339.6L265.9 339.2L267.1 340.2L270.2 340.7L271.9 342.7L272.8 341.9L278.4 342.6L280.7 342.0L281.5 343.8L283.7 344.5L285.5 348.3L284.8 349.3L284.9 350.9L285.7 351.6L285.0 353.4L288.2 356.8L288.0 357.7L288.8 358.9L289.8 359.3L288.4 361.9L288.6 363.3L291.5 363.4L292.0 362.8L292.6 363.4L296.9 363.3L297.9 364.1L296.8 367.2L297.2 368.2L298.9 367.0L299.8 368.0L300.8 366.9L301.9 368.9L301.5 369.6L302.4 370.2L303.4 370.0L301.3 372.7L300.1 373.1L300.2 374.0L298.6 375.0L296.8 378.9L290.1 379.2L285.7 382.0L281.2 379.3L280.8 379.9L280.6 379.3L279.1 380.0L278.5 379.5L278.4 380.1L277.6 379.6L276.7 380.2L276.8 380.8L273.9 379.2L274.1 379.9L273.2 380.0L272.2 382.1L270.4 382.1L270.1 382.7L269.7 382.0L269.6 382.6L268.0 381.9L266.1 383.1L265.5 384.2L266.3 386.6L264.4 387.2L264.1 387.8L263.0 386.2L258.8 386.4L255.2 384.5L250.4 384.2L248.8 383.3L244.7 383.9L242.5 382.2L239.3 382.7L238.3 382.2L237.1 380.6L237.2 379.7L236.1 378.8L236.2 376.7L235.4 374.7L234.7 374.9L233.2 373.9L233.0 374.6L233.0 373.1L231.8 373.7L232.1 374.2L229.8 374.3L229.2 375.5L227.3 374.3L227.0 372.6L229.2 369.1L229.0 366.6L231.2 359.5L230.2 356.7L233.0 354.6L234.3 348.7L237.3 347.0L238.7 342.6L246.1 338.0L249.2 338.7L250.5 338.0L251.5 338.8L254.4 338.6L254.7 339.3L255.5 338.9L255.9 337.4Z" fill={$v.mapa?.f?.PR} data-sel={$v.mapa?.s?.PR} data-dim={$v.mapa?.x?.PR} aria-label={$v.mapa?.l?.PR} onClick={$v.mapa?.c?.PR}></path>
                          {"\n              "}
                          <path className={"uf"} d="M344.1 346.7L343.2 347.5L341.7 347.6L339.9 346.2L340.8 343.2L344.3 341.4L344.6 341.8L346.9 341.2L348.2 339.3L347.4 338.4L345.6 338.1L344.2 338.9L342.7 338.5L340.9 335.8L342.4 335.7L345.0 334.2L347.3 334.4L352.8 331.9L355.1 332.2L358.8 331.3L360.1 331.6L360.1 332.5L360.8 332.3L363.0 330.7L370.1 327.8L369.0 326.6L370.3 325.1L369.8 324.7L371.0 322.2L370.8 321.3L372.3 319.6L371.5 318.9L373.5 318.4L374.7 316.4L376.6 317.7L376.5 320.7L381.6 322.1L383.8 321.8L385.3 322.8L384.0 325.4L384.7 326.5L385.0 331.2L382.5 332.8L376.8 334.8L373.7 337.6L373.4 339.8L374.8 340.2L372.9 342.1L373.1 343.2L367.2 342.4L361.0 343.0L360.1 342.5L361.3 340.1L360.7 339.3L358.4 340.6L358.9 341.7L359.9 342.6L358.3 343.4L356.5 343.5L355.2 344.1L353.4 343.9L355.0 343.8L351.7 342.0L349.5 343.0L349.5 342.5L347.8 343.9L347.2 343.8L347.2 343.2L346.0 343.6L346.6 342.7L346.1 342.3L345.2 342.6L344.9 343.5L342.3 343.8L341.7 345.4L341.8 346.0L342.6 345.4L342.8 345.9L342.4 345.8L342.0 346.2L342.9 346.0L342.5 346.7L343.6 345.9L343.3 346.4L344.1 346.7ZM356.9 343.0L357.9 343.1L358.1 343.3L357.9 343.1L357.4 342.9L356.9 343.0ZM347.3 344.3L349.0 345.3L346.5 345.3L346.2 345.9L346.0 345.9L345.7 345.3L347.3 344.3Z" fill={$v.mapa?.f?.RJ} data-sel={$v.mapa?.s?.RJ} data-dim={$v.mapa?.x?.RJ} aria-label={$v.mapa?.l?.RJ} onClick={$v.mapa?.c?.RJ}></path>
                          {"\n              "}
                          <path className={"uf"} d="M429.4 126.4L431.6 126.2L434.8 128.3L441.0 128.3L443.1 127.7L448.7 129.1L451.3 133.0L454.7 145.1L452.4 145.9L446.7 144.5L443.0 145.1L441.9 144.1L439.9 144.4L439.5 142.9L438.2 142.7L437.8 143.5L437.0 143.5L436.7 144.6L437.7 146.7L436.7 146.4L436.3 147.7L436.9 149.0L434.5 151.0L433.9 150.4L434.3 149.2L433.1 148.0L431.7 148.7L431.2 147.7L428.5 149.1L427.9 147.5L425.6 147.7L425.6 145.8L426.6 145.4L427.0 143.1L429.3 141.2L429.2 139.8L428.2 139.5L425.9 140.9L422.5 141.5L422.4 142.7L418.3 145.5L416.3 145.3L414.0 144.0L414.3 143.2L412.9 143.4L414.4 140.2L416.4 140.0L418.2 137.8L419.1 136.0L418.6 135.3L420.7 133.2L423.8 126.3L428.3 125.2L429.4 126.4Z" fill={$v.mapa?.f?.RN} data-sel={$v.mapa?.s?.RN} data-dim={$v.mapa?.x?.RN} aria-label={$v.mapa?.l?.RN} onClick={$v.mapa?.c?.RN}></path>
                          {"\n              "}
                          <path className={"uf"} d="M93.3 184.6L88.3 186.1L85.7 185.0L86.1 184.2L89.2 182.8L90.5 181.2L90.3 180.1L95.4 180.2L97.5 182.2L99.7 180.2L101.6 180.8L101.5 179.0L102.2 179.3L103.8 178.3L104.5 180.3L105.5 180.4L107.4 178.3L107.6 175.7L108.5 175.1L111.2 175.4L114.5 174.3L114.6 175.2L116.6 174.6L116.6 172.1L117.9 171.8L118.4 170.2L119.1 170.1L118.5 169.0L118.9 167.2L119.7 166.7L120.9 167.0L122.6 162.8L131.4 162.9L133.4 164.3L133.5 165.3L135.3 167.8L136.0 167.3L137.2 167.9L137.5 170.4L138.2 170.9L138.3 170.1L139.2 170.3L140.0 172.8L142.5 173.7L143.3 172.0L144.0 172.2L144.7 171.4L147.6 174.2L146.6 176.3L146.9 178.1L145.7 178.4L147.5 182.7L146.4 183.8L147.1 185.5L146.1 189.1L147.7 192.2L147.5 196.8L147.1 196.7L146.6 199.0L159.3 199.1L160.6 200.5L161.1 199.9L162.2 200.5L164.8 200.6L165.5 204.0L163.3 206.3L163.3 209.3L164.8 210.2L165.8 214.1L167.2 215.3L166.3 216.9L165.4 217.0L163.8 218.6L163.7 221.8L161.3 224.2L160.1 228.7L157.3 230.1L156.4 231.5L154.4 230.6L153.9 229.7L152.9 229.8L152.8 229.0L150.8 229.6L149.6 228.9L147.6 229.9L146.3 229.1L143.3 229.8L142.7 228.4L140.1 226.3L139.4 224.6L139.2 225.0L138.9 224.5L138.3 225.1L136.9 224.8L136.2 224.0L134.4 223.7L133.9 222.8L132.4 223.3L131.1 221.5L129.7 221.2L129.1 219.4L128.0 218.6L126.4 219.4L124.8 218.0L120.7 216.3L118.7 217.6L116.7 216.9L116.3 217.4L115.5 216.7L114.9 217.2L112.4 215.5L112.4 213.9L110.0 213.3L110.0 212.2L109.5 213.1L109.4 212.3L108.5 212.6L108.5 211.3L106.3 211.1L105.7 207.7L104.5 208.3L103.6 207.7L104.2 205.6L103.1 205.2L102.8 203.5L103.3 203.1L102.5 202.2L102.9 201.6L102.4 200.8L103.7 199.0L103.4 197.6L102.4 196.7L102.7 195.5L101.8 194.7L101.7 193.0L103.3 189.8L102.8 186.7L103.3 185.3L102.3 183.6L101.5 183.2L100.2 185.3L98.4 184.9L98.7 184.2L98.0 184.6L97.7 184.0L97.4 184.7L96.0 184.2L95.4 184.9L93.3 184.6Z" fill={$v.mapa?.f?.RO} data-sel={$v.mapa?.s?.RO} data-dim={$v.mapa?.x?.RO} aria-label={$v.mapa?.l?.RO} onClick={$v.mapa?.c?.RO}></path>
                          {"\n              "}
                          <path className={"uf"} d="M165.6 29.4L164.7 35.0L165.8 38.8L167.8 39.9L167.5 44.9L168.5 44.8L168.2 46.1L170.0 46.6L173.3 50.5L177.1 51.4L177.5 52.1L177.4 64.0L164.2 64.0L161.1 69.7L160.0 73.3L161.1 75.7L159.0 76.4L158.4 77.7L155.9 77.5L155.8 76.3L153.9 73.9L152.0 73.2L150.5 73.2L150.3 74.0L148.0 74.8L146.8 76.3L146.2 78.4L146.7 79.9L145.7 82.8L147.4 86.2L145.6 84.4L142.6 83.9L141.0 80.6L135.5 76.3L135.8 75.4L136.7 75.9L138.0 75.0L137.8 73.4L139.2 71.2L138.5 70.8L138.6 69.3L136.5 66.1L136.2 62.6L135.2 61.1L135.2 58.9L136.1 57.8L136.0 54.2L135.3 54.1L134.0 50.0L132.1 48.1L133.0 46.6L133.2 43.9L131.7 43.0L129.6 43.0L128.2 41.1L125.7 40.8L125.1 38.0L121.6 38.6L117.6 37.2L118.3 34.0L115.5 29.8L115.3 26.3L116.1 24.5L114.9 22.8L112.6 21.7L108.7 16.3L109.0 15.8L110.1 16.2L111.7 18.0L116.3 17.7L118.6 20.8L119.9 19.8L121.9 20.3L121.9 19.0L124.0 21.1L124.8 20.8L124.9 19.5L127.4 19.8L127.2 21.2L128.6 21.7L128.9 22.9L130.3 23.9L131.7 22.3L132.9 22.9L133.0 21.5L132.3 20.5L132.8 18.8L135.0 19.0L135.0 17.9L136.3 17.0L139.7 18.3L141.6 17.0L142.2 18.0L144.0 16.2L146.5 16.1L147.1 14.3L149.7 13.7L149.3 12.8L151.3 13.4L153.1 13.0L154.2 10.6L156.0 10.1L157.7 8.1L156.2 4.6L159.6 5.0L162.2 3.9L164.6 6.2L164.7 7.4L164.3 10.8L162.7 13.1L167.0 13.6L168.4 14.7L167.8 17.0L169.0 17.6L168.7 18.3L170.2 19.9L169.3 20.6L169.3 21.6L168.3 22.1L168.4 22.8L166.2 24.3L166.9 25.1L166.4 26.1L166.8 26.9L165.6 29.4Z" fill={$v.mapa?.f?.RR} data-sel={$v.mapa?.s?.RR} data-dim={$v.mapa?.x?.RR} aria-label={$v.mapa?.l?.RR} onClick={$v.mapa?.c?.RR}></path>
                          {"\n              "}
                          <path className={"uf"} d="M256.8 446.1L256.0 445.8L256.1 446.7L256.7 446.4L256.5 447.3L255.0 447.9L254.4 449.4L256.5 451.6L256.2 453.1L253.8 455.5L250.0 464.6L244.0 470.3L240.9 472.2L239.6 471.4L239.5 470.6L239.8 469.6L240.5 470.0L240.7 465.1L242.0 463.9L242.8 464.4L243.9 462.8L244.3 460.7L244.9 461.2L245.9 460.0L245.7 460.7L247.0 461.9L248.6 461.5L250.5 457.5L249.3 455.0L250.1 452.9L248.8 453.2L248.1 454.4L247.8 455.3L248.9 455.8L246.3 457.0L244.9 459.1L241.2 458.2L238.3 455.8L237.1 452.1L234.5 450.2L233.0 450.3L228.9 447.0L227.4 444.7L224.5 444.5L222.5 442.4L221.7 443.2L219.8 442.3L218.5 439.6L215.9 437.2L214.9 437.6L214.8 438.6L214.2 438.5L212.5 440.0L210.8 440.2L210.7 436.6L201.6 428.4L198.6 428.2L196.8 430.7L193.3 430.6L192.9 429.7L191.9 429.5L195.4 427.2L196.1 425.0L199.7 422.9L202.8 419.5L204.1 416.6L206.2 416.0L206.2 414.9L207.4 414.0L207.7 412.7L208.8 412.4L210.9 410.4L210.8 409.3L212.3 409.0L212.4 407.5L214.4 408.3L214.8 407.2L213.6 406.1L215.5 404.6L216.1 405.1L216.8 404.1L217.4 404.4L218.1 403.0L220.3 401.5L221.0 401.9L221.3 401.4L222.2 401.5L221.6 400.5L223.3 400.5L224.7 397.6L225.2 398.2L226.2 398.1L226.3 397.3L226.9 397.7L227.4 396.7L228.0 397.3L229.4 396.1L230.1 396.8L230.3 396.0L230.9 396.5L232.1 394.3L233.2 394.8L235.6 392.7L237.1 393.5L238.0 393.1L238.3 393.8L239.2 393.3L240.0 393.6L239.9 392.9L241.4 392.3L242.3 392.8L242.1 393.8L243.9 392.9L244.9 393.1L245.4 392.2L245.2 392.9L245.8 392.9L246.0 393.8L246.3 393.1L246.6 393.6L247.5 393.2L249.2 394.6L249.6 394.1L251.8 394.4L252.2 393.8L253.0 394.8L253.9 395.0L253.8 394.3L254.4 394.3L254.1 394.8L254.9 395.2L255.4 394.5L256.2 395.4L257.9 395.8L257.2 396.0L258.6 397.4L259.0 396.9L259.7 397.6L259.7 397.1L261.6 397.1L262.3 398.2L263.2 397.9L263.9 399.1L264.4 398.7L266.2 400.5L268.0 401.2L273.3 407.9L276.4 408.2L276.5 408.8L277.6 408.3L278.7 409.2L279.0 408.3L279.4 409.0L280.8 408.5L281.2 409.0L282.2 408.5L282.4 409.1L283.2 408.7L284.1 410.6L283.0 410.5L282.0 412.1L281.3 411.9L280.9 414.3L281.4 414.9L280.4 416.1L281.0 416.2L280.3 417.4L279.4 417.2L279.5 417.5L279.4 417.9L278.9 417.5L278.6 418.2L280.1 419.4L279.2 418.3L281.1 417.6L283.9 419.1L280.3 424.5L276.6 433.2L271.6 440.5L266.0 446.0L258.7 450.7L256.4 453.1L257.2 450.5L256.2 449.2L259.0 449.6L259.8 448.9L258.9 448.8L261.2 448.4L263.2 446.0L263.9 446.7L263.9 445.0L264.7 445.5L266.2 444.7L267.1 442.6L267.0 440.0L267.7 440.4L269.1 439.7L269.3 437.9L271.8 437.0L272.4 436.1L272.2 431.4L272.4 431.3L273.0 431.9L273.3 431.9L273.2 431.1L273.6 432.0L272.9 432.5L273.8 433.0L274.3 430.5L273.6 429.5L272.9 429.6L272.7 430.8L269.8 431.2L269.7 432.4L268.3 431.9L268.6 430.5L267.9 430.1L267.4 430.4L267.1 430.3L266.6 429.5L266.0 429.4L266.2 427.7L265.5 427.2L265.5 430.8L266.5 430.8L266.8 431.8L267.8 431.5L267.8 431.8L267.3 432.8L266.8 432.1L265.9 432.8L265.5 436.2L265.2 435.0L264.4 435.1L264.6 437.7L263.2 438.2L263.8 440.2L261.8 440.9L261.8 442.4L258.3 442.9L257.4 444.2L256.9 447.5L256.8 446.1Z" fill={$v.mapa?.f?.RS} data-sel={$v.mapa?.s?.RS} data-dim={$v.mapa?.x?.RS} aria-label={$v.mapa?.l?.RS} onClick={$v.mapa?.c?.RS}></path>
                          {"\n              "}
                          <path className={"uf"} d="M237.0 387.8L238.3 382.2L240.0 382.8L242.5 382.2L244.7 383.9L248.8 383.3L250.4 384.2L255.2 384.5L258.8 386.4L263.0 386.2L264.1 387.8L264.4 387.2L266.3 386.6L265.5 384.2L266.1 383.1L268.0 381.9L269.6 382.6L269.7 382.0L270.1 382.7L270.4 382.1L272.2 382.1L273.2 380.0L274.1 379.9L273.9 379.2L276.8 380.8L276.7 380.2L277.6 379.6L278.4 380.1L278.5 379.5L279.1 380.0L280.6 379.3L280.8 379.9L281.2 379.3L285.7 382.0L290.1 379.2L296.2 378.7L296.8 378.9L297.0 381.2L298.0 381.8L296.0 386.2L295.8 387.9L296.9 388.6L296.2 390.0L296.5 391.2L297.1 391.3L296.7 392.7L298.3 392.9L298.1 393.7L297.5 393.4L296.5 394.2L296.8 395.0L297.6 395.2L296.2 397.0L297.1 398.3L296.2 398.9L296.7 399.1L297.0 401.9L295.1 409.3L294.3 410.5L288.7 413.8L283.9 419.1L280.9 417.6L279.2 418.3L280.1 419.4L279.8 419.3L278.8 418.7L278.7 417.6L279.4 418.0L279.4 417.2L280.3 417.4L280.9 416.6L281.2 415.9L280.4 416.1L281.4 414.9L280.9 414.3L281.3 411.9L282.0 412.1L283.0 410.5L284.1 410.7L283.2 408.7L282.4 409.1L282.2 408.5L281.2 409.0L280.8 408.5L279.4 409.0L279.0 408.3L278.7 409.2L277.6 408.3L276.5 408.8L276.4 408.2L273.3 407.9L268.0 401.2L266.2 400.5L264.4 398.7L263.9 399.1L263.2 397.9L262.3 398.2L261.6 397.1L259.7 397.1L259.7 397.6L259.0 396.9L258.6 397.4L257.2 396.0L257.9 395.8L256.2 395.4L255.4 394.5L254.9 395.2L254.1 394.8L254.4 394.3L253.8 394.3L253.9 395.0L253.0 394.8L252.2 393.8L251.8 394.4L249.6 394.1L249.2 394.6L247.5 393.2L246.6 393.6L246.3 393.1L246.0 393.8L245.8 392.9L245.2 392.9L245.4 392.2L244.9 393.1L243.9 392.9L242.1 393.8L242.3 392.8L241.4 392.3L239.9 392.9L240.0 393.6L236.1 393.2L236.7 392.4L236.5 391.7L236.9 391.9L236.7 391.5L238.0 390.5L238.1 389.5L237.0 387.8ZM298.9 395.9L299.5 396.6L297.9 399.8L298.2 400.4L297.1 401.2L297.1 399.3L297.6 399.0L297.2 398.3L297.8 397.8L297.3 396.7L298.9 395.9Z" fill={$v.mapa?.f?.SC} data-sel={$v.mapa?.s?.SC} data-dim={$v.mapa?.x?.SC} aria-label={$v.mapa?.l?.SC} onClick={$v.mapa?.c?.SC}></path>
                          {"\n              "}
                          <path className={"uf"} d="M419.6 181.4L431.3 186.9L432.2 188.9L434.4 190.4L435.6 190.3L436.2 192.2L437.5 192.1L438.2 193.2L432.9 196.1L427.4 204.5L425.2 205.8L423.6 205.4L423.1 205.9L419.9 203.9L419.9 201.5L418.8 201.0L418.4 199.4L416.8 197.7L417.1 195.7L418.9 195.7L419.6 196.4L421.8 195.5L421.2 192.3L422.7 191.2L421.6 187.2L419.6 186.2L420.0 185.0L419.2 184.2L419.7 183.0L419.1 182.1L419.6 181.4Z" fill={$v.mapa?.f?.SE} data-sel={$v.mapa?.s?.SE} data-dim={$v.mapa?.x?.SE} aria-label={$v.mapa?.l?.SE} onClick={$v.mapa?.c?.SE}></path>
                          {"\n              "}
                          <path className={"uf"} d="M325.3 353.5L324.8 355.1L323.5 355.7L322.4 354.8L322.2 355.6L316.0 358.6L315.2 360.2L305.5 366.9L304.7 367.8L304.7 369.1L302.5 370.9L303.4 370.0L302.4 370.2L301.5 369.6L301.9 368.9L300.8 366.9L299.8 368.0L298.9 367.0L297.6 368.4L296.9 367.8L297.1 365.4L297.9 364.1L296.9 363.3L292.6 363.4L292.0 362.8L291.5 363.4L288.6 363.3L288.4 361.9L289.8 359.3L288.8 358.9L288.0 357.7L288.2 356.8L285.0 353.4L285.7 351.6L284.9 350.9L284.8 349.3L285.5 348.3L284.9 348.0L284.2 345.2L281.5 343.8L280.7 342.0L278.4 342.6L272.8 341.9L271.9 342.7L270.2 340.7L267.1 340.2L265.9 339.2L260.6 339.2L256.1 337.4L255.5 338.9L254.7 339.3L254.4 338.6L251.5 338.8L250.5 338.0L249.2 338.7L246.1 338.0L244.7 339.1L244.5 338.4L252.6 332.9L253.7 330.6L256.4 327.8L256.4 325.4L257.7 325.2L258.9 323.4L258.8 320.8L261.7 318.4L262.1 314.8L264.9 311.5L268.1 310.2L269.3 307.6L272.9 306.1L273.8 305.0L275.0 304.6L276.4 305.6L281.8 306.5L285.7 306.1L287.0 307.0L289.0 306.7L288.5 308.4L289.3 310.6L290.0 310.9L291.3 309.0L292.2 309.2L292.5 311.9L293.3 312.5L294.2 309.1L300.8 308.9L300.9 307.5L302.4 308.9L303.5 308.6L304.0 307.6L304.9 308.7L305.3 307.1L307.1 307.0L307.9 307.8L309.8 306.7L310.2 307.8L312.6 309.8L311.9 312.6L313.5 313.4L314.2 315.1L313.1 316.0L312.5 317.8L313.6 319.0L315.2 324.3L318.0 323.5L318.7 324.1L319.2 323.5L319.7 324.5L321.0 324.8L320.9 326.5L319.7 327.3L318.9 329.2L319.8 331.3L318.5 332.1L319.9 332.8L319.1 333.3L318.5 334.9L319.1 336.2L322.2 337.7L322.3 339.1L321.3 339.6L323.0 340.3L322.7 341.9L325.2 341.5L325.3 342.3L327.9 341.0L328.2 341.7L329.3 341.5L329.7 340.7L330.2 341.0L330.0 339.9L329.0 339.9L330.4 339.0L330.2 338.1L330.8 338.1L330.8 339.0L331.8 338.4L331.7 339.0L332.2 339.0L333.0 338.3L333.8 339.0L337.0 337.2L340.7 336.1L341.5 336.3L342.7 338.5L344.2 338.9L345.6 338.1L347.4 338.4L348.2 339.3L346.9 341.2L344.6 341.8L344.3 341.4L340.9 343.0L340.5 345.1L339.8 345.9L341.7 347.6L340.3 347.8L339.5 347.2L337.8 348.2L338.2 348.7L337.5 349.5L336.5 349.1L336.0 350.2L335.0 350.1L333.8 350.7L333.8 353.0L332.5 353.3L332.0 352.7L328.7 352.3L325.3 353.5ZM335.1 354.1L334.6 354.2L334.5 354.3L333.5 354.5L333.1 353.9L334.2 352.9L334.6 351.9L335.8 352.5L335.6 353.1L335.8 353.3L335.3 353.3L335.1 353.6L335.8 354.5L335.4 354.8L335.1 354.1Z" fill={$v.mapa?.f?.SP} data-sel={$v.mapa?.s?.SP} data-dim={$v.mapa?.x?.SP} aria-label={$v.mapa?.l?.SP} onClick={$v.mapa?.c?.SP}></path>
                          {"\n              "}
                          <path className={"uf"} d="M315.4 173.7L314.5 176.0L316.2 176.0L318.0 180.1L319.2 179.9L320.4 181.0L320.6 181.9L319.4 184.0L321.2 185.1L321.6 187.8L322.6 189.2L325.0 189.7L326.5 189.3L326.8 190.3L329.3 190.4L330.4 189.2L330.4 190.4L329.9 191.3L328.9 191.6L328.9 192.4L324.4 195.0L324.6 195.8L324.0 196.3L323.6 198.1L322.3 199.1L321.4 201.5L319.7 202.7L321.3 205.4L325.9 206.7L323.2 206.8L322.5 209.6L324.9 210.0L322.3 211.7L322.8 215.2L323.9 216.3L323.9 217.1L325.1 217.0L323.6 218.2L323.3 222.6L325.5 222.3L322.7 223.1L322.6 221.6L322.0 221.1L321.6 222.8L318.2 222.8L315.5 224.8L312.6 225.5L312.0 226.4L310.9 226.0L310.3 226.7L309.7 225.4L308.8 225.4L308.8 224.7L307.9 224.4L307.5 225.7L308.1 227.6L307.4 228.8L305.7 226.9L304.1 227.0L303.0 226.0L301.8 226.9L301.7 225.0L298.6 226.7L297.8 224.7L296.9 227.0L296.7 223.9L295.2 223.1L293.8 220.9L292.4 222.7L291.2 222.0L290.7 220.7L289.3 221.8L288.0 224.4L287.8 226.5L281.5 222.8L277.1 221.3L277.0 219.4L278.3 218.0L278.0 217.0L278.9 215.9L276.3 217.7L274.6 221.5L273.3 221.0L273.0 219.0L272.3 218.5L273.3 216.3L272.5 213.6L273.1 209.8L272.1 208.1L272.9 206.4L271.9 205.7L271.9 204.7L273.4 200.0L273.5 195.1L275.7 191.5L276.0 188.8L279.3 182.3L280.1 178.7L283.5 174.1L285.2 173.3L287.7 168.7L288.8 167.7L290.4 160.8L288.4 159.4L287.6 157.7L290.0 154.0L289.7 150.3L291.9 148.6L294.3 148.2L296.0 147.1L296.2 145.3L297.8 143.5L299.3 143.8L298.7 141.3L300.3 140.4L299.8 139.2L301.0 138.5L300.3 136.3L301.7 135.7L302.2 134.6L300.2 133.5L299.2 131.9L297.8 132.4L295.1 131.6L295.8 130.9L296.7 131.2L297.7 129.5L299.5 129.2L302.8 130.5L304.5 130.1L305.5 131.7L306.7 131.8L309.5 133.5L310.9 142.4L309.1 150.9L306.6 153.6L307.8 154.8L308.5 154.4L309.5 154.7L309.7 155.6L308.4 156.5L309.4 156.4L314.8 163.8L319.9 161.9L321.3 163.3L321.0 166.4L317.5 168.0L316.3 170.3L316.3 173.4L315.4 173.7Z" fill={$v.mapa?.f?.TO} data-sel={$v.mapa?.s?.TO} data-dim={$v.mapa?.x?.TO} aria-label={$v.mapa?.l?.TO} onClick={$v.mapa?.c?.TO}></path>
                          {"\n              "}
                          <path className={"uf"} d="M311.7 259.6L311.7 259.8L300.5 259.8L300.8 258.5L300.7 258.3L300.5 258.4L300.5 257.8L300.4 257.3L300.6 256.9L300.9 256.8L301.3 256.1L301.3 255.8L301.2 255.7L300.9 255.7L301.0 254.9L301.2 254.7L301.4 254.7L301.4 253.2L310.4 253.2L310.4 253.8L310.6 253.8L310.9 254.1L311.6 254.2L311.6 254.3L311.4 254.8L311.5 255.0L311.4 255.4L311.7 255.5L311.6 255.8L311.6 256.2L311.2 257.1L311.0 257.1L310.9 258.0L311.1 258.1L311.1 258.4L311.0 258.4L311.0 258.5L310.9 258.9L311.0 259.2L311.3 259.3L311.4 259.3L311.3 259.4L311.6 259.5L311.6 259.6L311.7 259.6Z" fill={$v.mapa?.f?.DF} data-sel={$v.mapa?.s?.DF} data-dim={$v.mapa?.x?.DF} aria-label={$v.mapa?.l?.DF} onClick={$v.mapa?.c?.DF}></path>
                          {"\n                  "}
                        </svg>
                        {"\n                  "}
                        {__arr($v.mapa?.bolhas).map((b, $index) => (<React.Fragment key={$index}>
                          {"\n                    "}
                          <button className={"mapa-bolha"} data-sel={b?.sel} data-dim={b?.dim} style={__css(`left: ${__s(b?.x)}; top: ${__s(b?.y)}; width: ${__s(b?.r)}; height: ${__s(b?.r)};`)} onClick={b?.selecionar} aria-label={b?.rotulo}>
                            {__t(b?.n)}
                          </button>
                          {"\n                  "}
                        </React.Fragment>))}
                        {"\n                  "}
                        {__arr($v.mapa?.pins).map((p, $index) => (<React.Fragment key={$index}>
                          {"\n                    "}
                          <button className={"mapa-pin"} data-nivel={p?.nivel} data-dim={p?.dim} style={__css(`left: ${__s(p?.x)}; top: ${__s(p?.y)};`)} onClick={p?.abrir} aria-label={p?.rotulo}>
                            {"\n                      "}
                            <svg viewBox="0 0 24 32" aria-hidden="true">
                              <path d="M12 31s10-10.3 10-18.5C22 6.7 17.5 2 12 2S2 6.7 2 12.5C2 20.7 12 31 12 31z"></path>
                              <circle cx="12" cy="12.5" r="4.2"></circle>
                            </svg>
                            {"\n                      "}
                            <span className={"pin-tip"}>
                              <b>
                                {__t(p?.nome)}
                              </b>
                              <span>
                                {__t(p?.cidade)}{" · Fit "}{__t(p?.fit)}
                              </span>
                              <span className={"chamas"}>
                                {__arr(p?.chamas).map((ch, $index) => (<React.Fragment key={$index}>
                                  <svg className={"chama"} viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill={ch?.g} d="M12.2 1.8c.9 3.4 4.9 5.4 5.8 9.3 1 4.6-1.9 9.9-6.2 9.9-4 0-6.7-3.2-6.2-7.2.3-2.3 1.6-3.7 2.5-5.3.3 1.6 1.1 2.6 2.2 3.1-.4-3.6 0-7.2 1.9-9.8z"></path>
                                    <path fill="url(#fogo-nucleo)" d="M12.1 11.4c.8 1.6 2.7 2.6 2.7 5 0 1.9-1.2 3.2-2.8 3.2-1.5 0-2.7-1.2-2.7-2.9 0-1.4.8-2.2 1.4-3.1.2.7.6 1.2 1 1.4-.1-1.4 0-2.6.4-3.6z"></path>
                                  </svg>
                                </React.Fragment>))}
                              </span>
                              <span style={{"color":"var(--signal)"}}>
                                {"Abrir conta e comitê"}
                              </span>
                            </span>
                            {"\n                    "}
                          </button>
                          {"\n                  "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"mapa-legenda"} aria-hidden="true">
                        {"\n                    "}
                        <span>
                          {"Contas por estado"}
                        </span>
                        {"\n                    "}
                        <span className={"mapa-escala"}>
                          <i style={{"background":"var(--mapa-0)"}}></i>
                          <i style={{"background":"var(--mapa-1)"}}></i>
                          <i style={{"background":"var(--mapa-2)"}}></i>
                          <i style={{"background":"var(--mapa-3)"}}></i>
                          <i style={{"background":"var(--mapa-4)"}}></i>
                        </span>
                        {"\n                    "}
                        <span style={{"display":"flex","justifyContent":"space-between"}}>
                          <span>
                            {"0"}
                          </span>
                          <span>
                            {__t($v.mapa?.maxTexto)}
                          </span>
                        </span>
                        {"\n                    "}
                        <span className={"mapa-leg-pin"}>
                          <svg viewBox="0 0 24 32" width="10" height="13" aria-hidden="true">
                            <path d="M12 31s10-10.3 10-18.5C22 6.7 17.5 2 12 2S2 6.7 2 12.5C2 20.7 12 31 12 31z" fill="currentColor"></path>
                          </svg>
                          {"Conta com comitê mapeado"}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <aside className={"mapa-lado"}>
                      {"\n                  "}
                      <div className={"chips"} role="radiogroup" aria-label="Região">
                        {__arr($v.mapa?.regioes).map((r, $index) => (<React.Fragment key={$index}>
                          <button className={"chip"} role="radio" aria-checked={r?.ativo} aria-pressed={r?.ativo} onClick={r?.escolher}>
                            {__t(r?.label)}{" "}
                            <span style={{"opacity":"0.6"}}>
                              {__t(r?.n)}
                            </span>
                          </button>
                        </React.Fragment>))}
                      </div>
                      {"\n                  "}
                      {$v.mapa?.temUf ? (<>
                        {"\n                    "}
                        <div className={"mapa-uf"}>
                          {"\n                      "}
                          <div style={{"display":"flex","alignItems":"baseline","justifyContent":"space-between","gap":"8px"}}>
                            <span style={{"fontFamily":"var(--f-display)","fontSize":"22px"}}>
                              {__t($v.mapa?.uf?.nome)}
                            </span>
                            <button className={"icon-btn"} onClick={$v.mapa?.limpar} aria-label="Limpar estado" title="Limpar">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18"></path>
                              </svg>
                            </button>
                          </div>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t($v.mapa?.uf?.resumo)}
                          </span>
                          {"\n                      "}
                          {__arr($v.mapa?.uf?.contas).map((c, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <button className={"mapa-conta"} onClick={c?.abrir}>
                              <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","alignItems":"flex-start"}}>
                                <span style={{"fontSize":"14px","fontWeight":"500"}}>
                                  {__t(c?.nome)}
                                </span>
                                <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                  {__t(c?.cidade)}{" · Fit "}{__t(c?.fit)}{" · "}{__t(c?.sinal)}
                                </span>
                              </span>
                              <span className={"pilha"}>
                                {__arr(c?.fotos).map((ft, $index) => (<React.Fragment key={$index}>
                                  <img className={"foto foto-xs"} src={ft} alt="" />
                                </React.Fragment>))}
                              </span>
                            </button>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                      "}
                          {$v.mapa?.uf?.semDossie ? (<>
                            <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                              {"Nenhuma conta deste estado tem comitê mapeado ainda."}
                            </span>
                          </>) : null}
                          {"\n                      "}
                          {$v.mapa?.uf?.temLista ? (<>
                            <button className={"b-sec mini-btn"} onClick={$v.mapa?.uf?.verTodas} style={{"alignSelf":"flex-start"}}>
                              {__t($v.mapa?.uf?.verTexto)}
                            </button>
                          </>) : null}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      {$v.mapa?.semUf ? (<>
                        {"\n                    "}
                        <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                          {"\n                      "}
                          <span className={"cad-label"}>
                            {"Estados com mais contas"}
                          </span>
                          {"\n                      "}
                          {__arr($v.mapa?.ranking).map((r, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <button className={"mapa-rank"} onClick={r?.selecionar}>
                              <span className={"mapa-rank-uf"}>
                                {__t(r?.uf)}
                              </span>
                              <span className={"mapa-rank-bar"}>
                                <span style={__css(`width: ${__s(r?.pct)};`)}></span>
                              </span>
                              <span className={"num"} style={{"fontSize":"13px","minWidth":"32px","textAlign":"right"}}>
                                {__t(r?.n)}
                              </span>
                            </button>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      <div className={"mapa-nota"}>
                        {"\n                    "}
                        <span>
                          <b>
                            {"De onde vem a localização:"}
                          </b>
                          {" do endereço do CNPJ e do site, capturados no enriquecimento. A conta entra no mapa assim que é criada."}
                        </span>
                        {"\n                    "}
                        <span>
                          <b>
                            {"Escala:"}
                          </b>
                          {" o mapa mostra contas com sinal no período escolhido. Os números agrupam por estado; os pins mostram as contas com comitê mapeado. Clique no estado para ver as contas dele."}
                        </span>
                        {"\n                    "}
                        <span>
                          {__t($v.mapa?.semLocal)}{" contas sem endereço ainda ficam fora do mapa."}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </aside>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </section>
                {"\n            "}
                <div style={__css(`display: grid; grid-template-columns: ${__s($v.lay?.homeCols)}; gap: 24px; align-items: start;`)}>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"24px","minWidth":"0"}}>
                    {"\n                "}
                    <section style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                      {"\n                  "}
                      <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                        {"Próximas ações"}
                      </h2>
                      {"\n                  "}
                      {$v.acoesVazio ? (<>
                        {"\n                    "}
                        <div style={{"padding":"24px","background":"var(--mist)","display":"flex","flexDirection":"column","gap":"8px"}}>
                          <span style={{"fontSize":"15px"}}>
                            {"Nenhuma ação pendente"}
                          </span>
                          <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                            {"Quando agentes ou o estrategista criarem tarefas para você, elas aparecem aqui por prioridade."}
                          </span>
                        </div>
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      <div style={{"borderTop":"1px solid var(--rule)"}}>
                        {"\n                    "}
                        {__arr($v.acoes).map((a, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div style={{"minHeight":"56px","padding":"12px 0","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"center","gap":"14px","flexWrap":"wrap"}}>
                            {"\n                        "}
                            <span style={__css(`flex: none; width: 54px; font-size: 12px; color: ${__s(a?.corPri)};`)}>
                              {__t(a?.prioridade)}
                            </span>
                            {"\n                        "}
                            <span style={{"flex":"1 1 240px","minWidth":"0","fontSize":"14px"}}>
                              {__t(a?.titulo)}
                            </span>
                            {"\n                        "}
                            <span style={{"flex":"none","fontSize":"13px","color":"var(--graphite)"}}>
                              {__t(a?.resp)}{" · "}{__t(a?.prazo)}
                            </span>
                            {"\n                        "}
                            <span style={{"flex":"none","padding":"2px 8px","border":"1px solid var(--rule)","fontSize":"13px","color":"var(--graphite)","borderRadius":"999px"}}>
                              {__t(a?.origem)}
                            </span>
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"24px","minWidth":"0"}}>
                    {"\n                "}
                    {$v.mostraAprovHome ? (<>
                      {"\n                  "}
                      <section style={{"border":"1px solid var(--rule)","padding":"18px","display":"flex","flexDirection":"column","gap":"12px","borderRadius":"14px","overflow":"hidden"}}>
                        {"\n                    "}
                        <div style={{"display":"flex","justifyContent":"space-between","alignItems":"baseline","gap":"8px"}}>
                          <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                            {"Aprovações pendentes"}
                          </h2>
                          <a href={$v.hrefAprov} style={{"fontSize":"14px","textDecoration":"underline"}}>
                            {"Ver todas"}
                          </a>
                        </div>
                        {"\n                    "}
                        {__arr($v.aprovHome).map((p, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <button className={"b-ghost"} onClick={p?.abrir} style={{"minHeight":"44px","padding":"10px 0","border":"none","borderTop":"1px solid var(--rule)","background":"transparent","fontFamily":"inherit","color":"var(--ink)","cursor":"pointer","textAlign":"left","display":"flex","flexDirection":"column","gap":"2px"}}>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                              {__t(p?.tipo)}{" · até "}{__t(p?.prazo)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"14px"}}>
                              {__t(p?.titulo)}
                            </span>
                            {"\n                      "}
                          </button>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </section>
                      {"\n                "}
                    </>) : null}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vAgentes ? (<>
              {"\n          "}
              <div style={{"padding":"28px 24px 48px","maxWidth":"1400px","display":"flex","flexDirection":"column","gap":"20px"}}>
                {"\n            "}
                <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                  <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"38px","lineHeight":"1.1"}}>
                    {"Agentes"}
                  </h1>
                  <span style={{"fontSize":"14px","color":"var(--graphite)","maxWidth":"70ch"}}>
                    {"Quatro agentes trabalham juntos no workspace. Você personaliza o playbook, as skills, os sinais e os conectores de cada um."}
                  </span>
                </div>
                {"\n            "}
                <div className={"ag4"}>
                  {"\n              "}
                  {__arr($v.agentes).map((a, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <article className={"ag4-card"}>
                      {"\n                  "}
                      <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
                        {"\n                    "}
                        <span className={"ag4-tile"}>
                          {__t(a?.sigla)}
                        </span>
                        {"\n                    "}
                        <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"1px"}}>
                          <a href={a?.href} style={{"fontFamily":"var(--f-display)","fontSize":"22px","lineHeight":"1.15"}}>
                            {__t(a?.nome)}
                          </a>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(a?.funcao)}
                          </span>
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <p style={{"margin":"0","fontSize":"14px","color":"var(--text-2)","textWrap":"pretty"}}>
                        {__t(a?.objetivo)}
                      </p>
                      {"\n                  "}
                      <dl className={"ag4-num"}>
                        {"\n                    "}
                        <div>
                          <dt>
                            {"Execuções"}
                          </dt>
                          <dd>
                            {__t(a?.execCiclo)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt>
                            {"Sinais"}
                          </dt>
                          <dd>
                            {__t(a?.sinaisN)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt>
                            {"Skills"}
                          </dt>
                          <dd>
                            {__t(a?.skillsN)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt>
                            {"Autonomia"}
                          </dt>
                          <dd className={"ag4-txt"}>
                            {__t(a?.autonomia)}
                          </dd>
                        </div>
                        {"\n                  "}
                      </dl>
                      {"\n                  "}
                      <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                        {"\n                    "}
                        <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={a?.conversar}>
                          {"Conversar"}
                        </button>
                        {"\n                    "}
                        <button className={"b-sec mini-btn"} onClick={a?.personalizar}>
                          {"Personalizar"}
                        </button>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </article>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vAgente ? (<>
              {"\n          "}
              <div style={{"padding":"24px 24px 48px","maxWidth":"1280px","display":"flex","flexDirection":"column","gap":"20px"}}>
                {"\n            "}
                <div style={{"display":"flex","alignItems":"center","gap":"16px","flexWrap":"wrap"}}>
                  {"\n              "}
                  <span style={{"flex":"none","width":"56px","height":"56px","display":"grid","placeItems":"center","background":"var(--ink)","color":"var(--paper)","fontSize":"16px"}}>
                    {__t($v.ag?.sigla)}
                  </span>
                  {"\n              "}
                  <div style={{"flex":"1 1 260px","minWidth":"0","display":"flex","flexDirection":"column","gap":"4px"}}>
                    {"\n                "}
                    <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"32px","lineHeight":"1.1"}}>
                      {__t($v.ag?.nome)}
                    </h1>
                    {"\n                "}
                    <span style={{"display":"flex","alignItems":"center","gap":"8px","flexWrap":"wrap","fontSize":"14px","color":"var(--graphite)"}}>
                      <span style={__css(`width: 8px; height: 8px; border-radius: 50%; background: ${__s($v.ag?.estadoCor)};`)}></span>
                      {__t($v.ag?.estadoLabel)}{" · "}{__t($v.ag?.autonomia)}{" · Responsável: "}{__t($v.ag?.responsavel)}
                    </span>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                    {"\n                "}
                    {__arr($v.ag?.acoes).map((b, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button onClick={b?.fn} style={__css(`min-height: 44px; padding: 0 14px; border: 1px solid ${__s(b?.borda)}; background: ${__s(b?.bg)}; color: ${__s(b?.cor)}; font-family: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; border-radius: 10px;`)}>
                        {__t(b?.label)}
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n            "}
                {$v.avisoAgente ? (<>
                  {"\n              "}
                  <div role="status" style={{"padding":"10px 14px","border":"1px solid var(--ok)","fontSize":"14px","display":"flex","gap":"10px","alignItems":"center","borderRadius":"14px","overflow":"hidden"}}>
                    <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--ok)"}}></span>
                    {__t($v.avisoTexto)}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                <div role="tablist" aria-label="Seções do agente" style={{"display":"flex","gap":"2px","overflowX":"auto","overflowY":"hidden","borderBottom":"1px solid var(--rule)"}}>
                  {"\n              "}
                  {__arr($v.agTabsDet).map((t, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <button className={"b-ghost"} role="tab" aria-selected={t?.ativo} onClick={t?.ir} style={__css(`flex: none; min-height: 44px; padding: 0 14px; border: none; border-bottom: 2px solid ${__s(t?.barra)}; margin-bottom: -1px; background: transparent; color: var(--ink); font-family: inherit; font-size: 14px; cursor: pointer; white-space: nowrap;`)}>
                      {__t(t?.label)}
                    </button>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </div>
                {"\n\n            "}
                {$v.tVisao ? (<>
                  {"\n              "}
                  <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(280px, 1fr))","gap":"16px"}}>
                    {"\n                "}
                    <section style={{"border":"1px solid var(--rule)","padding":"18px","display":"flex","flexDirection":"column","gap":"10px","borderRadius":"14px","overflow":"hidden"}}>
                      {"\n                  "}
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {"Objetivo"}
                      </span>
                      {"\n                  "}
                      <p style={{"margin":"0","fontSize":"15px","textWrap":"pretty"}}>
                        {__t($v.ag?.objetivo)}
                      </p>
                      {"\n                  "}
                      <span style={{"marginTop":"6px","fontSize":"13px","color":"var(--graphite)"}}>
                        {"Escopo permitido"}
                      </span>
                      {"\n                  "}
                      <p style={{"margin":"0","fontSize":"15px","color":"var(--text-2)","textWrap":"pretty"}}>
                        {__t($v.ag?.escopo)}
                      </p>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section style={{"border":"1px solid var(--rule)","padding":"18px","display":"grid","gridTemplateColumns":"1fr 1fr","gap":"14px","borderRadius":"14px","overflow":"hidden"}}>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Execuções no ciclo"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"30px"}}>
                          {__t($v.ag?.execCiclo)}
                        </div>
                      </div>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Taxa de sucesso"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"30px"}}>
                          {__t($v.ag?.sucesso)}{"%"}
                        </div>
                      </div>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Pendências"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"30px"}}>
                          {__t($v.ag?.pendencias)}
                        </div>
                      </div>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Última atividade"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"20px","paddingTop":"6px"}}>
                          {__t($v.ag?.ultima)}
                        </div>
                      </div>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section style={{"gridColumn":"1 / -1","border":"1px solid var(--rule)","borderRadius":"14px","padding":"18px 18px 6px","display":"flex","flexDirection":"column","gap":"18px"}}>
                      {"\n                  "}
                      <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                        {"Evolução do agente"}
                      </h2>
                      {"\n                  "}
                      <ol className={"tl tl-alt"} aria-label="Versões do agente">
                        {"\n                    "}
                        {__arr($v.versoesAg).map((f, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <li className={"tl-item"} data-state={f?.st}>
                            {"\n                        "}
                            <span className={"tl-ind"}></span>
                            {"\n                        "}
                            <time className={"tl-date"}>
                              {__t(f?.label)}
                            </time>
                            {"\n                        "}
                            <span className={"tl-title"}>
                              {__t(f?.titulo)}
                            </span>
                            {"\n                        "}
                            <span className={"tl-content"}>
                              {__t(f?.det)}
                            </span>
                            {"\n                      "}
                          </li>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </ol>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tConversa ? (<>
                  {"\n              "}
                  <div style={__css(`display: grid; grid-template-columns: ${__s($v.lay?.chatCols)}; gap: 16px; align-items: start;`)}>
                    {"\n                "}
                    {$v.lay?.notMobile ? (<>
                      {"\n                  "}
                      <div style={{"border":"1px solid var(--rule)","display":"flex","flexDirection":"column","borderRadius":"14px","overflow":"hidden"}}>
                        {"\n                    "}
                        <span style={{"padding":"12px 14px","fontSize":"13px","color":"var(--graphite)","borderBottom":"1px solid var(--rule)"}}>
                          {"Threads"}
                        </span>
                        {"\n                    "}
                        {__arr($v.threads).map((th, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <span style={__css(`min-height: 44px; padding: 10px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; background: ${__s(th?.bg)}; display: flex; flex-direction: column;`)}>
                            <span>
                              {__t(th?.titulo)}
                            </span>
                            <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                              {__t(th?.quando)}
                            </span>
                          </span>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    <div style={{"minWidth":"0","border":"1px solid var(--rule)","display":"flex","flexDirection":"column","borderRadius":"14px","overflow":"hidden"}}>
                      {"\n                  "}
                      <div className={"thread"} aria-live="polite" style={{"padding":"22px 20px"}}>
                        {"\n                    "}
                        {__arr($v.chat).map((m, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          {m?.isUser ? (<>
                            {"\n                        "}
                            <div className={"msg"} data-align="end">
                              {"\n                          "}
                              <span className={"msg-av msg-av-pessoa"}>
                                {__t($v.usuario?.sigla)}
                              </span>
                              {"\n                          "}
                              <div className={"msg-body"}>
                                {"\n                            "}
                                <div className={"bubble bubble-ink"}>
                                  {__t(m?.texto)}
                                </div>
                                {"\n                            "}
                                <span className={"msg-foot"}>
                                  {__t(m?.hora)}
                                  <span aria-hidden="true">
                                    {"·"}
                                  </span>
                                  {__t(m?.status)}
                                </span>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.isAgente ? (<>
                            {"\n                        "}
                            <div className={"msg"} style={{"alignItems":"flex-start"}}>
                              {"\n                          "}
                              <span className={"msg-av msg-av-agente"}>
                                {__t($v.ag?.sigla)}
                              </span>
                              {"\n                          "}
                              <div className={"msg-body msg-body-wide"}>
                                {"\n                            "}
                                <span className={"msg-head"}>
                                  <b>
                                    {__t($v.ag?.nome)}
                                  </b>
                                  <span className={"msg-tag"}>
                                    {"agente"}
                                  </span>
                                </span>
                                {"\n                            "}
                                <span role="status" style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                                  {__t(m?.anuncio)}
                                </span>
                                {"\n                            "}
                                {m?.pensando ? (<>
                                  {"\n                              "}
                                  <div className={"bubble bubble-ghost"} aria-busy="true">
                                    <span className={"marker"}>
                                      <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"16px"}}>
                                        <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                                      </svg>
                                      <span className={"marker-pulse"}>
                                        {__t(m?.marcador)}
                                      </span>
                                    </span>
                                  </div>
                                  {"\n                            "}
                                </>) : null}
                                {"\n                            "}
                                {m?.temTexto ? (<>
                                  {"\n                              "}
                                  <div className={"bubble bubble-ghost"} aria-busy={m?.busy}>
                                    {__t(m?.textoVis)}
                                    {m?.cursor ? (<>
                                      <span className={"caret"} aria-hidden="true"></span>
                                    </>) : null}
                                  </div>
                                  {"\n                            "}
                                </>) : null}
                                {"\n                            "}
                                <div className={"msg-foot"} style={__css(`visibility: ${__s(m?.footVis)};`)}>
                                  {"\n                              "}
                                  <span>
                                    {__t(m?.hora)}
                                  </span>
                                  {"\n                              "}
                                  <button className={"msg-act"} onClick={m?.copiar} aria-label="Copiar resposta" title="Copiar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <rect x="8" y="8" width="12" height="12"></rect>
                                      <path d="M16 8V4H4v12h4"></path>
                                    </svg>
                                    <span>
                                      {__t(m?.copiarLabel)}
                                    </span>
                                  </button>
                                  {"\n                              "}
                                  <button className={"msg-act"} onClick={m?.refazer} aria-label="Gerar de novo" title="Gerar de novo">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M20 12a8 8 0 1 1-2.34-5.66"></path>
                                      <path d="M20 4v5h-5"></path>
                                    </svg>
                                  </button>
                                  {"\n                              "}
                                  <button className={"msg-act"} onClick={m?.util} aria-pressed={m?.utilOn} aria-label="Resposta útil" title="Útil">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M7 11v9H4v-9h3z"></path>
                                      <path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5.2a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.4A2 2 0 0 1 17.3 20H7"></path>
                                    </svg>
                                  </button>
                                  {"\n                              "}
                                  <button className={"msg-act"} onClick={m?.inutil} aria-pressed={m?.inutilOn} aria-label="Resposta não ajudou" title="Não ajudou">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M17 13V4h3v9h-3z"></path>
                                      <path d="M17 13l-4 7c-1.5 0-2.5-1-2.5-2.5V14H5.3a1.8 1.8 0 0 1-1.8-2.1l1.2-6.4A2 2 0 0 1 6.7 4H17"></path>
                                    </svg>
                                  </button>
                                  {"\n                            "}
                                </div>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.isDeleg ? (<>
                            {"\n                        "}
                            <div className={"msg-deleg"}>
                              {__t(m?.texto)}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.isPlano ? (<>
                            {"\n                        "}
                            <div style={{"marginLeft":"38px","maxWidth":"560px","border":"1px solid var(--ink)","padding":"14px 16px","display":"flex","flexDirection":"column","gap":"10px","borderRadius":"14px","overflow":"hidden"}}>
                              {"\n                          "}
                              <span style={{"fontSize":"13px","fontWeight":"500"}}>
                                {"Plano antes de ação sensível"}
                              </span>
                              {"\n                          "}
                              <ol style={{"margin":"0","paddingLeft":"20px","display":"flex","flexDirection":"column","gap":"4px","fontSize":"14px"}}>
                                {__arr(m?.passos).map((p, $index) => (<React.Fragment key={$index}>
                                  <li>
                                    {__t(p)}
                                  </li>
                                </React.Fragment>))}
                              </ol>
                              {"\n                          "}
                              {m?.pendente ? (<>
                                {"\n                            "}
                                <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                                  {"\n                              "}
                                  <button className={"b-pri"} onClick={$v.aprovarPlano} style={{"minHeight":"40px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                                    {__t($v.rotuloPlano)}
                                  </button>
                                  {"\n                            "}
                                </div>
                                {"\n                          "}
                              </>) : null}
                              {"\n                          "}
                              {m?.resolvido ? (<>
                                <span style={{"display":"flex","alignItems":"center","gap":"8px","fontSize":"14px"}}>
                                  <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--ok)"}}></span>
                                  {__t(m?.resultado)}
                                </span>
                              </>) : null}
                              {"\n                        "}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div style={{"borderTop":"1px solid var(--rule)","padding":"12px","display":"flex","flexDirection":"column","gap":"10px"}}>
                        {"\n                    "}
                        <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                          {"\n                      "}
                          {__arr($v.comandos).map((c, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <button className={"b-sec"} onClick={c?.fn} style={{"minHeight":"36px","padding":"0 10px","border":"1px solid var(--rule)","background":"var(--paper)","fontFamily":"inherit","fontSize":"13px","color":"var(--ink)","cursor":"pointer","borderRadius":"10px"}}>
                              {__t(c?.label)}
                            </button>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        <div style={{"display":"flex","gap":"8px","alignItems":"flex-end"}}>
                          {"\n                      "}
                          <label style={{"flex":"1 1 auto","minWidth":"0"}}>
                            <span style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                              {"Mensagem"}
                            </span>
                            {"\n                        "}
                            <textarea value={__val($v.msgTexto)} onChange={$v.mudarMsg} onKeyDown={$v.teclaMsg} placeholder={`Escreva para ${__s($v.ag?.nome)}`} rows="2" style={{"width":"100%","boxSizing":"border-box","minHeight":"48px","resize":"vertical","border":"1px solid var(--rule)","padding":"10px 12px","fontFamily":"inherit","fontWeight":"400","fontSize":"14px","color":"var(--ink)","outline":"none","borderRadius":"10px"}}></textarea>
                            {"\n                      "}
                          </label>
                          {"\n                      "}
                          <button className={"b-pri"} onClick={$v.enviarMsg} style={{"flex":"none","height":"48px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                            {"Enviar"}
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tCapacidades ? (<>
                  {"\n              "}
                  <div style={{"border":"1px solid var(--rule)","borderRadius":"16px"}}>
                    {"\n                "}
                    {__arr($v.capacidades).map((c, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"minHeight":"56px","padding":"8px 18px","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"center","gap":"12px"}}>
                        {"\n                    "}
                        <span style={{"flex":"1 1 auto","fontSize":"14px"}}>
                          {__t(c?.label)}
                        </span>
                        {"\n                    "}
                        {c?.editavel ? (<>
                          {"\n                      "}
                          <button className={"b-ghost"} role="switch" aria-checked={c?.on} aria-label={c?.label} onClick={c?.alternar} style={{"width":"52px","height":"44px","padding":"0","border":"none","background":"transparent","cursor":"pointer","display":"grid","placeItems":"center"}}>
                            <span style={__css(`width: 44px; height: 24px; box-sizing: border-box; padding: 3px; display: flex; justify-content: ${__s(c?.lado)}; background: ${__s(c?.trilho)};`)}>
                              <span style={{"width":"18px","height":"18px","background":"var(--paper)"}}></span>
                            </span>
                          </button>
                          {"\n                    "}
                        </>) : null}
                        {"\n                    "}
                        {c?.leitura ? (<>
                          <span style={__css(`font-size: 14px; color: ${__s(c?.corTxt)};`)}>
                            {__t(c?.estado)}
                          </span>
                        </>) : null}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tPlaybooks ? (<>
                  {"\n              "}
                  <div className={"pb-grid"}>
                    {"\n                "}
                    <section className={"cfg-box"} style={{"display":"flex","flexDirection":"column"}}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Playbook · "}{__t($v.pb?.versao)}
                        </span>
                        <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                          {__t($v.pb?.status)}
                        </span>
                      </div>
                      {"\n                  "}
                      <p style={{"margin":"0","padding":"12px 16px 0","fontSize":"13px","color":"var(--graphite)"}}>
                        {"É a base que o agente segue em toda tarefa: missão, regras, processo e o que ele nunca deve fazer. Escreva como se estivesse treinando uma pessoa nova no time."}
                      </p>
                      {"\n                  "}
                      <textarea className={"pb-editor"} value={__val($v.pb?.texto)} onChange={$v.pb?.mudar} aria-label={`Playbook do ${__s($v.ag?.nome)}`} spellCheck="true" readOnly={$v.pb?.somenteLeitura}></textarea>
                      {"\n                  "}
                      <div className={"cfg-acoes"} style={{"justifyContent":"space-between","alignItems":"center","paddingTop":"12px"}}>
                        <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                          {__t($v.pb?.contagem)}
                        </span>
                        {$v.pb?.editavel ? (<>
                          <span style={{"display":"flex","gap":"8px"}}>
                            <button className={"b-sec mini-btn"} onClick={$v.pb?.descartar} style={{"height":"38px"}}>
                              {"Descartar alterações"}
                            </button>
                            <button className={"b-pri cfg-salvar"} onClick={$v.pb?.salvar}>
                              {"Publicar "}{__t($v.pb?.proxima)}
                            </button>
                          </span>
                        </>) : null}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <aside style={{"display":"flex","flexDirection":"column","gap":"14px","minWidth":"0"}}>
                      {"\n                  "}
                      <section className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          <span>
                            {"Aprendizados sugeridos"}
                          </span>
                          <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                            {__t($v.pb?.nSug)}
                          </span>
                        </div>
                        {"\n                    "}
                        {__arr($v.pb?.sugestoes).map((s, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div className={"sug"}>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","fontWeight":"500"}}>
                              {__t(s?.aprendizado)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","color":"var(--text-2)"}}>
                              {__t(s?.mudanca)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"11px","color":"var(--muted)"}}>
                              {__t(s?.origem)}
                            </span>
                            {"\n                        "}
                            {$v.pb?.editavel ? (<>
                              <span style={{"display":"flex","gap":"6px","marginTop":"4px"}}>
                                <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={s?.aplicar}>
                                  {"Aplicar no playbook"}
                                </button>
                                <button className={"b-sec mini-btn"} onClick={s?.descartar}>
                                  {"Descartar"}
                                </button>
                              </span>
                            </>) : null}
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                    "}
                        {$v.pb?.semSug ? (<>
                          <div className={"cfg-row"} style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Nada novo. O agente sugere mudanças quando percebe um padrão nas aprovações, respostas e resultados."}
                          </div>
                        </>) : null}
                        {"\n                  "}
                      </section>
                      {"\n                  "}
                      <section className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          {"Versões"}
                        </div>
                        {"\n                    "}
                        {__arr($v.pb?.versoes).map((vv, $index) => (<React.Fragment key={$index}>
                          <div className={"cfg-row cfg-row-line"} style={{"padding":"10px 16px"}}>
                            <span style={{"fontSize":"13px","fontWeight":"500","minWidth":"40px"}}>
                              {__t(vv?.v)}
                            </span>
                            <span style={{"flex":"1 1 auto","fontSize":"12px","color":"var(--graphite)"}}>
                              {__t(vv?.quem)}{" · "}{__t(vv?.quando)}
                            </span>
                          </div>
                        </React.Fragment>))}
                        {"\n                  "}
                      </section>
                      {"\n                "}
                    </aside>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tConhecimento ? (<>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"flex-end","justifyContent":"space-between","gap":"12px","flexWrap":"wrap"}}>
                      <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)","maxWidth":"70ch"}}>
                        {"Skills são procedimentos guardados que o agente aciona sozinho quando a situação do gatilho acontece. O playbook diz como ele pensa; a skill diz como ele executa uma tarefa específica."}
                      </p>
                      {"\n                  "}
                      {$v.sk?.editavel ? (<>
                        <span style={{"display":"flex","gap":"8px"}}>
                          <label className={"b-sec mini-btn"} style={{"cursor":"pointer"}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 16V4M7 9l5-5 5 5"></path>
                              <path d="M4 20h16"></path>
                            </svg>
                            {"Importar .md"}
                            <input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={$v.sk?.importar} style={{"position":"absolute","width":"1px","height":"1px","opacity":"0"}} />
                          </label>
                          <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={$v.sk?.abrirNova}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 5v14M5 12h14"></path>
                            </svg>
                            {"Nova skill"}
                          </button>
                        </span>
                      </>) : null}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    {$v.sk?.formAberto ? (<>
                      {"\n                  "}
                      <section className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          {"Nova skill"}
                        </div>
                        {"\n                    "}
                        <div className={"cfg-grid"}>
                          {"\n                      "}
                          <label className={"cfg-campo"}>
                            <span>
                              {"Nome"}
                            </span>
                            <input value={__val($v.sk?.nome)} onChange={$v.sk?.mudarNome} placeholder="Ex.: Resposta a objeção de preço" />
                          </label>
                          {"\n                      "}
                          <label className={"cfg-campo"}>
                            <span>
                              {"Quando usar"}
                            </span>
                            <input value={__val($v.sk?.quando)} onChange={$v.sk?.mudarQuando} placeholder="Ex.: Quando a resposta citar preço ou orçamento" />
                          </label>
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        <label className={"cfg-campo"} style={{"padding":"0 16px 16px"}}>
                          <span>
                            {"Instruções"}
                          </span>
                          <textarea className={"cad-input"} rows="7" value={__val($v.sk?.instrucoes)} onChange={$v.sk?.mudarInstrucoes} placeholder="Passo a passo, exemplos bons e ruins, formato da saída."></textarea>
                        </label>
                        {"\n                    "}
                        {$v.sk?.temErro ? (<>
                          <div className={"cfg-erro"} role="alert">
                            {__t($v.sk?.erro)}
                          </div>
                        </>) : null}
                        {"\n                    "}
                        <div className={"cfg-acoes"}>
                          <button className={"b-sec mini-btn"} onClick={$v.sk?.cancelar} style={{"height":"38px"}}>
                            {"Cancelar"}
                          </button>
                          <button className={"b-pri cfg-salvar"} onClick={$v.sk?.salvar}>
                            {"Salvar skill"}
                          </button>
                        </div>
                        {"\n                  "}
                      </section>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      {__arr($v.sk?.lista).map((s, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"cfg-row cfg-row-line skill"}>
                          {"\n                      "}
                          <span className={"skill-ic"}>
                            {"/"}
                          </span>
                          {"\n                      "}
                          <span style={{"flex":"1 1 220px","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(s?.nome)}
                              <span className={"skill-slug"}>
                                {"/"}{__t(s?.id)}
                              </span>
                            </span>
                            <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                              {"Gatilho: "}{__t(s?.quando)}
                            </span>
                          </span>
                          {"\n                      "}
                          {s?.nova ? (<>
                            <span className={"con-tag con-ok"}>
                              {"Nova"}
                            </span>
                          </>) : null}
                          {"\n                      "}
                          <button className={"switch"} role="switch" aria-checked={s?.ativo} aria-label={`Usar a skill ${__s(s?.nome)}`} onClick={s?.alternar} disabled={$v.sk?.somenteLeitura}>
                            <span></span>
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        {"Contexto fixo"}
                      </div>
                      {"\n                  "}
                      <div className={"papeis"}>
                        {__arr($v.conhecimento).map((k, $index) => (<React.Fragment key={$index}>
                          <div className={"papel"}>
                            <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                              {__t(k?.tipo)}
                            </span>
                            <span style={{"fontSize":"14px"}}>
                              {__t(k?.nome)}
                            </span>
                          </div>
                        </React.Fragment>))}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tSinais ? (<>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                    {"\n                "}
                    <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)","maxWidth":"72ch"}}>
                      {"Sinais são buscas que o agente faz na internet e nas suas fontes para trazer informação nova sobre as contas. Cada sinal ativo consome créditos por conta verificada."}
                    </p>
                    {"\n                "}
                    <div className={"sinais"}>
                      {"\n                  "}
                      {__arr($v.sinaisAg).map((s, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"sinal"} data-ativo={s?.ativo}>
                          {"\n                      "}
                          <span className={"sinal-ic"}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="8.5"></circle>
                              <circle cx="12" cy="12" r="4.5"></circle>
                              <path d="M12 12l6-6"></path>
                            </svg>
                          </span>
                          {"\n                      "}
                          <span style={{"flex":"1 1 260px","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                            {"\n                        "}
                            <span style={{"display":"flex","alignItems":"center","gap":"6px","flexWrap":"wrap"}}>
                              <span style={{"fontSize":"14px","fontWeight":"500"}}>
                                {__t(s?.nome)}
                              </span>
                              {s?.custom ? (<>
                                <span className={"con-tag"} style={{"color":"var(--signal)","background":"color-mix(in srgb, var(--signal) 12%, transparent)"}}>
                                  {"Personalizado"}
                                </span>
                              </>) : null}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","color":"var(--text-2)"}}>
                              {__t(s?.desc)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"12px","color":"var(--muted)"}}>
                              {"Fonte: "}{__t(s?.fonte)}{" · "}{__t(s?.freq)}
                            </span>
                            {"\n                      "}
                          </span>
                          {"\n                      "}
                          <span className={"sinal-custo"}>
                            <b>
                              {__t(s?.custo)}
                            </b>
                            <span>
                              {"créditos por conta"}
                            </span>
                          </span>
                          {"\n                      "}
                          <button className={"switch"} role="switch" aria-checked={s?.ativo} aria-label={`Ativar ${__s(s?.nome)}`} onClick={s?.alternar} disabled={s?.travado}>
                            <span></span>
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    {$v.sinalForm?.pode ? (<>
                      {"\n                  "}
                      <section className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          <span>
                            {"Sinal personalizado"}
                          </span>
                          <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                            {"Só superadmin"}
                          </span>
                        </div>
                        {"\n                    "}
                        <div className={"cfg-grid"}>
                          {"\n                      "}
                          <label className={"cfg-campo"}>
                            <span>
                              {"Nome do sinal"}
                            </span>
                            <input value={__val($v.sinalForm?.nome)} onChange={$v.sinalForm?.mudarNome} placeholder="Ex.: Empresas anunciando no TikTok Ads" />
                          </label>
                          {"\n                      "}
                          <label className={"cfg-campo"}>
                            <span>
                              {"Fonte"}
                            </span>
                            <input value={__val($v.sinalForm?.fonte)} onChange={$v.sinalForm?.mudarFonte} placeholder="URL ou nome da fonte pública" />
                          </label>
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        <label className={"cfg-campo"} style={{"padding":"0 16px 12px"}}>
                          <span>
                            {"O que buscar e o que trazer"}
                          </span>
                          <textarea className={"cad-input"} rows="3" value={__val($v.sinalForm?.desc)} onChange={$v.sinalForm?.mudarDesc} placeholder="Ex.: anúncios ativos no TikTok com o CNPJ ou domínio da conta; trazer data de início e criativo"></textarea>
                        </label>
                        {"\n                    "}
                        <div className={"cfg-row"} style={{"paddingTop":"0"}}>
                          <span className={"cad-label"}>
                            {"Frequência"}
                          </span>
                          <div className={"seg seg-li"} role="radiogroup" aria-label="Frequência">
                            {__arr($v.sinalForm?.freqs).map((o, $index) => (<React.Fragment key={$index}>
                              <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                {__t(o?.label)}
                              </button>
                            </React.Fragment>))}
                          </div>
                          <span className={"cad-label"} style={{"marginLeft":"12px"}}>
                            {"Créditos por conta"}
                          </span>
                          <span className={"stepper"}>
                            <button onClick={$v.sinalForm?.menos} aria-label="Menos">
                              {"−"}
                            </button>
                            <span className={"num"}>
                              {__t($v.sinalForm?.custo)}
                            </span>
                            <button onClick={$v.sinalForm?.mais} aria-label="Mais">
                              {"+"}
                            </button>
                          </span>
                        </div>
                        {"\n                    "}
                        {$v.sinalForm?.temErro ? (<>
                          <div className={"cfg-erro"} role="alert">
                            {__t($v.sinalForm?.erro)}
                          </div>
                        </>) : null}
                        {"\n                    "}
                        <div className={"cfg-acoes"}>
                          <button className={"b-pri cfg-salvar"} onClick={$v.sinalForm?.salvar}>
                            {"Adicionar sinal ao "}{__t($v.ag?.nome)}
                          </button>
                        </div>
                        {"\n                  "}
                      </section>
                      {"\n                "}
                    </>) : null}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tIntegracoes ? (<>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"center","justifyContent":"space-between","gap":"12px","flexWrap":"wrap"}}>
                      {"\n                  "}
                      <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)","maxWidth":"60ch"}}>
                        {"Escolha quais conectores do workspace este agente usa e o que ele pode fazer em cada um. Nenhuma credencial é exibida."}
                      </p>
                      {"\n                  "}
                      <a className={"b-sec mini-btn"} href={$v.hrefIntegracoes}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path>
                          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>
                        </svg>
                        {"Adicionar conector"}
                      </a>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"ag-con-list"}>
                      {"\n                  "}
                      {__arr($v.agConectores).map((c, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"ag-con"} data-uso={c?.usa}>
                          {"\n                      "}
                          <span className={"con-logo"}>
                            <img src={c?.logo} alt={`Logo ${__s(c?.nome)}`} />
                          </span>
                          {"\n                      "}
                          <span style={{"flex":"1 1 180px","minWidth":"0","display":"flex","flexDirection":"column","gap":"1px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(c?.nome)}
                            </span>
                            <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                              {__t(c?.sub)}
                            </span>
                          </span>
                          {"\n                      "}
                          <div className={"seg seg-li"} role="radiogroup" aria-label={`Permissão em ${__s(c?.nome)}`}>
                            {__arr(c?.modos).map((o, $index) => (<React.Fragment key={$index}>
                              <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher} disabled={c?.desligado}>
                                {__t(o?.label)}
                              </button>
                            </React.Fragment>))}
                          </div>
                          {"\n                      "}
                          <button className={"switch"} role="switch" aria-checked={c?.usa} aria-label={`Usar ${__s(c?.nome)} neste agente`} onClick={c?.alternar}>
                            <span></span>
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tExecucoes ? (<>
                  {"\n              "}
                  <div style={{"borderTop":"1px solid var(--rule)"}}>
                    {"\n                "}
                    {$v.agExecVazio ? (<>
                      <div style={{"padding":"24px 0","fontSize":"14px","color":"var(--graphite)"}}>
                        {"Este agente ainda não tem execuções neste ciclo."}
                      </div>
                    </>) : null}
                    {"\n                "}
                    {__arr($v.agExecs).map((e, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <a href={e?.href} style={{"minHeight":"56px","padding":"10px 0","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"center","gap":"16px","flexWrap":"wrap"}}>
                        {"\n                    "}
                        <span style={{"flex":"1 1 260px","fontSize":"14px"}}>
                          {__t(e?.titulo)}
                        </span>
                        {"\n                    "}
                        <span style={{"display":"flex","alignItems":"center","gap":"6px","fontSize":"14px"}}>
                          <span style={__css(`width: 8px; height: 8px; border-radius: 50%; background: ${__s(e?.cor)};`)}></span>
                          {__t(e?.status)}
                        </span>
                        {"\n                    "}
                        <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                          {__t(e?.validos)}{" válidos · "}{__t(e?.credCons)}{" créditos"}
                        </span>
                        {"\n                  "}
                      </a>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n\n            "}
                {$v.tAuditoria ? (<>
                  {"\n              "}
                  <ol className={"tl tl-av"} style={{"maxWidth":"760px"}}>
                    {"\n                "}
                    {__arr($v.auditoria).map((u, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <li className={"tl-item"}>
                        {"\n                    "}
                        <span className={"tl-ind"}>
                          {__t(u?.sigla)}
                        </span>
                        {"\n                    "}
                        <span className={"tl-sep"}></span>
                        {"\n                    "}
                        <span className={"tl-head"} style={{"alignItems":"flex-start"}}>
                          {"\n                      "}
                          <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                            {"\n                        "}
                            <span className={"tl-content"} style={{"color":"var(--ink)"}}>
                              <b style={{"fontWeight":"500"}}>
                                {__t(u?.autor)}
                              </b>
                              {" "}
                              <span style={{"color":"var(--graphite)"}}>
                                {"alterou"}
                              </span>
                              {" "}{__t(u?.mudanca)}
                            </span>
                            {"\n                        "}
                            <time className={"tl-date"}>
                              {__t(u?.data)}{" · "}{__t(u?.versao)}
                            </time>
                            {"\n                      "}
                          </span>
                          {"\n                      "}
                          <button className={"b-sec"} onClick={u?.rollback} style={{"flex":"none","height":"36px","padding":"0 12px","border":"1px solid var(--steel)","borderRadius":"10px","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer"}}>
                            {"Restaurar "}{__t(u?.versao)}
                          </button>
                          {"\n                    "}
                        </span>
                        {"\n                  "}
                      </li>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </ol>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vExecucoes ? (<>
              {"\n          "}
              <div style={{"padding":"28px 24px 48px","maxWidth":"1400px","display":"flex","flexDirection":"column","gap":"18px"}}>
                {"\n            "}
                <div style={{"display":"flex","alignItems":"flex-end","justifyContent":"space-between","gap":"16px","flexWrap":"wrap"}}>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                    <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"38px","lineHeight":"1.1"}}>
                      {"Execuções"}
                    </h1>
                    <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                      {"Trabalho assíncrono da plataforma"}
                    </span>
                  </div>
                  {"\n              "}
                  <div role="tablist" aria-label="Visualização" style={{"display":"flex","border":"1px solid var(--ink)","borderRadius":"14px","overflow":"hidden"}}>
                    {"\n                "}
                    {__arr($v.exViews).map((v, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button role="tab" aria-selected={v?.ativo} onClick={v?.ir} style={__css(`min-height: 44px; padding: 0 16px; border: none; background: ${__s(v?.bg)}; color: ${__s(v?.cor)}; font-family: inherit; font-size: 13px; cursor: pointer;`)}>
                        {__t(v?.label)}
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n            "}
                <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                  {"\n              "}
                  {__arr($v.exFiltros).map((f, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <button aria-pressed={f?.ativo} onClick={f?.ir} style={__css(`display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid ${__s(f?.borda)}; background: ${__s(f?.bg)}; color: ${__s(f?.cor)}; font-family: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; border-radius: 10px;`)}>
                      {__t(f?.label)}{" · "}{__t(f?.n)}
                    </button>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </div>
                {"\n            "}
                {$v.exVazio ? (<>
                  {"\n              "}
                  <div style={{"padding":"32px 24px","background":"var(--mist)","display":"flex","flexDirection":"column","gap":"8px","alignItems":"flex-start"}}>
                    <span style={{"fontSize":"18px"}}>
                      {"Nenhuma execução neste filtro"}
                    </span>
                    <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                      {"Execuções aparecem aqui quando agentes ou o copiloto começam um trabalho."}
                    </span>
                    {$v.podeCopiloto ? (<>
                      <button className={"b-sec"} onClick={$v.abrirCopiloto} style={{"height":"44px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--paper)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                        {"Criar solicitação"}
                      </button>
                    </>) : null}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.exLista ? (<>
                  {"\n              "}
                  <div style={{"borderTop":"1px solid var(--rule)"}}>
                    {"\n                "}
                    {__arr($v.execs).map((e, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <a className="v18-hover-0" href={e?.href} style={__css(`padding: 14px 0; border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: ${__s($v.lay?.exCols)}; gap: 8px 16px; align-items: center;`)}>
                        {"\n                    "}
                        <span style={{"minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {__t(e?.titulo)}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(e?.id)}{" · "}{__t(e?.tipo)}{" · "}{__t(e?.agenteNome)}{" · "}{__t(e?.horario)}
                          </span>
                        </span>
                        {"\n                    "}
                        <span style={{"display":"flex","alignItems":"center","gap":"6px","fontSize":"14px"}}>
                          <span style={__css(`width: 8px; height: 8px; border-radius: 50%; background: ${__s(e?.cor)};`)}></span>
                          {__t(e?.status)}
                        </span>
                        {"\n                    "}
                        <span style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                          <span style={{"height":"4px","background":"var(--rule)"}}>
                            <span style={__css(`display: block; height: 4px; width: ${__s(e?.pct)}; background: var(--ink);`)}></span>
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(e?.validos)}{" de "}{__t(e?.processados)}{" válidos"}
                          </span>
                        </span>
                        {"\n                    "}
                        <span style={{"fontSize":"14px","color":"var(--graphite)","whiteSpace":"nowrap"}}>
                          {__t(e?.credCons)}{" / "}{__t(e?.credEst)}{" créditos"}
                        </span>
                        {"\n                  "}
                      </a>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.exKanban ? (<>
                  {"\n              "}
                  <div style={{"display":"grid","gridAutoFlow":"column","gridAutoColumns":"minmax(250px, 1fr)","gap":"12px","overflowX":"auto","paddingBottom":"8px"}}>
                    {"\n                "}
                    {__arr($v.kanban).map((col, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"background":"var(--mist)","padding":"10px","display":"flex","flexDirection":"column","gap":"8px","minHeight":"200px"}}>
                        {"\n                    "}
                        <span style={{"padding":"4px 4px 6px","fontSize":"13px","color":"var(--graphite)"}}>
                          {__t(col?.titulo)}{" · "}{__t(col?.n)}
                        </span>
                        {"\n                    "}
                        {__arr(col?.itens).map((e, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <a href={e?.href} style={{"background":"var(--paper)","border":"1px solid var(--rule)","padding":"12px","display":"flex","flexDirection":"column","gap":"6px","borderRadius":"14px"}}>
                            {"\n                        "}
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(e?.titulo)}
                            </span>
                            {"\n                        "}
                            <span style={{"display":"flex","alignItems":"center","gap":"6px","fontSize":"13px","color":"var(--graphite)"}}>
                              <span style={__css(`width: 7px; height: 7px; border-radius: 50%; background: ${__s(e?.cor)};`)}></span>
                              {__t(e?.status)}
                            </span>
                            {"\n                        "}
                            <span style={{"height":"3px","background":"var(--rule)"}}>
                              <span style={__css(`display: block; height: 3px; width: ${__s(e?.pct)}; background: var(--ink);`)}></span>
                            </span>
                            {"\n                      "}
                          </a>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.exTimeline ? (<>
                  {"\n              "}
                  <ol className={"tl"} style={{"maxWidth":"720px"}}>
                    {"\n                "}
                    {__arr($v.execs).map((e, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <li className={"tl-item"}>
                        {"\n                    "}
                        <span className={"tl-ind tl-ind-solid"} style={__css(`background: ${__s(e?.cor)};`)}>
                          {e?.i_check ? (<>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                            </svg>
                          </>) : null}
                          {e?.i_x ? (<>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M7 7l10 10M17 7L7 17"></path>
                            </svg>
                          </>) : null}
                          {e?.i_run ? (<>
                            <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"12px"}}>
                              <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                            </svg>
                          </>) : null}
                          {e?.i_clock ? (<>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="8"></circle>
                              <path d="M12 8v4.5l3 2"></path>
                            </svg>
                          </>) : null}
                        </span>
                        {"\n                    "}
                        <span className={"tl-sep"}></span>
                        {"\n                    "}
                        <a className={"tl-link"} href={e?.href}>
                          {"\n                      "}
                          <span className={"tl-head"}>
                            <span className={"tl-title"}>
                              {__t(e?.titulo)}
                            </span>
                            <span className={"tl-badge"} style={__css(`color: ${__s(e?.cor)}; background: ${__s(e?.tinta)};`)}>
                              {__t(e?.status)}
                            </span>
                          </span>
                          {"\n                      "}
                          <span className={"tl-content"}>
                            {__t(e?.horario)}{" · "}{__t(e?.agenteNome)}
                          </span>
                          {"\n                    "}
                        </a>
                        {"\n                  "}
                      </li>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </ol>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vExecucao ? (<>
              {"\n          "}
              <div style={{"padding":"24px 24px 48px","maxWidth":"1200px","display":"flex","flexDirection":"column","gap":"20px"}}>
                {"\n            "}
                <div style={{"display":"flex","alignItems":"flex-start","gap":"16px","flexWrap":"wrap"}}>
                  {"\n              "}
                  <div style={{"flex":"1 1 320px","minWidth":"0","display":"flex","flexDirection":"column","gap":"6px"}}>
                    {"\n                "}
                    <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"32px","lineHeight":"1.15"}}>
                      {__t($v.ex?.titulo)}
                    </h1>
                    {"\n                "}
                    <span style={{"display":"flex","alignItems":"center","gap":"8px","fontSize":"14px"}}>
                      <span style={__css(`width: 8px; height: 8px; border-radius: 50%; background: ${__s($v.ex?.cor)};`)}></span>
                      {__t($v.ex?.status)}{" · "}{__t($v.ex?.id)}
                    </span>
                    {"\n                "}
                    <ol className={"tl tl-h"} aria-label="Ciclo da execução" style={{"marginTop":"14px","maxWidth":"640px"}}>
                      {"\n                  "}
                      {__arr($v.ex?.fases).map((f, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <li className={"tl-item"} data-done={f?.done} data-state={f?.st}>
                          {"\n                      "}
                          <span className={"tl-sep"}></span>
                          {"\n                      "}
                          <span className={"tl-ind tl-ind-solid"}>
                            {f?.i_check ? (<>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                              </svg>
                            </>) : null}
                            {f?.i_play ? (<>
                              <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M7 4.5v15l12-7.5z" fill="currentColor"></path>
                              </svg>
                            </>) : null}
                            {f?.i_x ? (<>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M7 7l10 10M17 7L7 17"></path>
                              </svg>
                            </>) : null}
                          </span>
                          {"\n                      "}
                          <span className={"tl-title"}>
                            {__t(f?.label)}
                            {f?.atual ? (<>
                              <span className={"tl-badge tl-badge-signal"}>
                                {"Atual"}
                              </span>
                            </>) : null}
                          </span>
                          {"\n                      "}
                          <span className={"tl-date"}>
                            {__t(f?.nota)}
                          </span>
                          {"\n                    "}
                        </li>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </ol>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                    {"\n                "}
                    {__arr($v.exAcoes).map((b, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button className={"b-sec"} onClick={b?.fn} style={__css(`min-height: 44px; padding: 0 14px; border: 1px solid ${__s(b?.borda)}; background: var(--paper); color: ${__s(b?.cor)}; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 10px;`)}>
                        {__t(b?.label)}
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n            "}
                {$v.avisoExec ? (<>
                  {"\n              "}
                  <div role="status" style={{"padding":"10px 14px","border":"1px solid var(--ok)","fontSize":"14px","display":"flex","gap":"10px","alignItems":"center","borderRadius":"14px","overflow":"hidden"}}>
                    <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--ok)"}}></span>
                    {__t($v.avisoTexto)}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.ex?.temErros ? (<>
                  {"\n              "}
                  <div role="alert" style={{"padding":"12px 14px","border":"1px solid var(--err)","display":"flex","flexDirection":"column","gap":"4px","borderRadius":"14px","overflow":"hidden"}}>
                    {"\n                "}
                    <span style={{"fontSize":"12px","color":"var(--err)"}}>
                      {__t($v.ex?.rotuloErro)}
                    </span>
                    {"\n                "}
                    {__arr($v.ex?.erros).map((er, $index) => (<React.Fragment key={$index}>
                      <span style={{"fontSize":"14px"}}>
                        {__t(er)}
                      </span>
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                <section className={"ledger"} aria-label="Resumo" style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(200px, 1fr))"}}>
                  {"\n              "}
                  {__arr($v.ex?.resumo).map((r, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <div style={{"padding":"14px 16px","display":"flex","flexDirection":"column","gap":"4px"}}>
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t(r?.label)}
                      </span>
                      <span style={{"fontSize":"15px"}}>
                        {__t(r?.valor)}
                      </span>
                    </div>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </section>
                {"\n            "}
                <div style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(300px, 1fr))","gap":"16px","alignItems":"start"}}>
                  {"\n              "}
                  <section style={{"border":"1px solid var(--rule)","padding":"18px","display":"flex","flexDirection":"column","gap":"12px","borderRadius":"14px","overflow":"hidden"}}>
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                      {"Plano e etapas"}
                    </h2>
                    {"\n                "}
                    <ol className={"tl tl-pipe"}>
                      {"\n                  "}
                      {__arr($v.ex?.etapas).map((p, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <li className={"tl-item"} data-done={p?.done} data-state={p?.st}>
                          {"\n                      "}
                          <span className={"tl-ind"}>
                            {p?.i_check ? (<>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                              </svg>
                            </>) : null}
                            {p?.i_run ? (<>
                              <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"12px"}}>
                                <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                              </svg>
                            </>) : null}
                          </span>
                          {"\n                      "}
                          <span className={"tl-sep"}></span>
                          {"\n                      "}
                          <span className={"tl-head"}>
                            <span className={"tl-title"}>
                              {__t(p?.texto)}
                            </span>
                            <span className={"tl-meta"}>
                              {__t(p?.estado)}
                            </span>
                          </span>
                          {"\n                    "}
                        </li>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </ol>
                    {"\n              "}
                  </section>
                  {"\n              "}
                  <section style={{"border":"1px solid var(--rule)","padding":"18px","display":"flex","flexDirection":"column","gap":"12px","borderRadius":"14px","overflow":"hidden"}}>
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                      {"Créditos"}
                    </h2>
                    {"\n                "}
                    <div style={{"display":"grid","gridTemplateColumns":"repeat(3, minmax(0, 1fr))","gap":"8px"}}>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Estimados"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"22px"}}>
                          {__t($v.ex?.credEst)}
                        </div>
                      </div>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Reservados"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"22px"}}>
                          {__t($v.ex?.credRes)}
                        </div>
                      </div>
                      {"\n                  "}
                      <div>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Consumidos"}
                        </span>
                        <div style={{"fontFamily":"var(--f-display)","fontSize":"22px"}}>
                          {__t($v.ex?.credCons)}
                        </div>
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    {$v.mostraCusto ? (<>
                      {"\n                  "}
                      <div style={{"padding":"10px 12px","background":"var(--ink)","color":"var(--mist)","display":"flex","justifyContent":"space-between","gap":"8px","fontSize":"14px"}}>
                        <span>
                          {"Custo real · somente superadmin"}
                        </span>
                        <span>
                          {__t($v.ex?.custo)}
                        </span>
                      </div>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"8px 0 0","fontWeight":"400","fontSize":"18px"}}>
                      {"Histórico"}
                    </h2>
                    {"\n                "}
                    <ol className={"tl tl-compact"}>
                      {"\n                  "}
                      {__arr($v.ex?.logsTl).map((l, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <li className={"tl-item"} data-done="true">
                          <span className={"tl-ind"}></span>
                          <span className={"tl-sep"}></span>
                          <span className={"tl-head"}>
                            <time className={"tl-date"}>
                              {__t(l?.hora)}
                            </time>
                            <span className={"tl-title"}>
                              {__t(l?.texto)}
                            </span>
                          </span>
                        </li>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </ol>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vAprovacoes ? (<>
              {"\n          "}
              <div style={{"padding":"28px 24px 48px","maxWidth":"1400px","display":"flex","flexDirection":"column","gap":"18px"}}>
                {"\n            "}
                <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                  <h1 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"38px","lineHeight":"1.1"}}>
                    {"Aprovações"}
                  </h1>
                  <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                    {__t($v.apPendentes)}{" pendentes"}
                  </span>
                </div>
                {"\n            "}
                <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                  {"\n              "}
                  {__arr($v.apFiltros).map((f, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <button aria-pressed={f?.ativo} onClick={f?.ir} style={__css(`display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid ${__s(f?.borda)}; background: ${__s(f?.bg)}; color: ${__s(f?.cor)}; font-family: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; border-radius: 10px;`)}>
                      {__t(f?.label)}
                    </button>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </div>
                {"\n            "}
                {$v.apVazio ? (<>
                  {"\n              "}
                  <div style={{"padding":"32px 24px","background":"var(--mist)","display":"flex","flexDirection":"column","gap":"8px"}}>
                    <span style={{"fontSize":"18px"}}>
                      {"Nada para aprovar"}
                    </span>
                    <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                      {"Quando um agente ou o estrategista pedir sua decisão, o item aparece aqui com prévia e impacto."}
                    </span>
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.apTem ? (<>
                  {"\n              "}
                  <div style={__css(`display: grid; grid-template-columns: ${__s($v.lay?.apCols)}; gap: 20px; align-items: start;`)}>
                    {"\n                "}
                    <div role="listbox" aria-label="Itens para aprovar" style={{"borderTop":"1px solid var(--rule)","minWidth":"0"}}>
                      {"\n                  "}
                      {__arr($v.aprov).map((p, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <button role="option" aria-selected={p?.sel} onClick={p?.abrir} style={__css(`width: 100%; min-height: 64px; padding: 12px 14px; border: none; border-bottom: 1px solid var(--rule); background: ${__s(p?.bg)}; font-family: inherit; color: var(--ink); cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 3px;`)}>
                          {"\n                      "}
                          <span style={{"display":"flex","justifyContent":"space-between","gap":"8px","fontSize":"13px","color":"var(--graphite)"}}>
                            <span>
                              {__t(p?.tipo)}
                            </span>
                            <span style={__css(`color: ${__s(p?.corDecisao)};`)}>
                              {__t(p?.decisao)}
                            </span>
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"14px"}}>
                            {__t(p?.titulo)}
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(p?.solicitante)}{" · até "}{__t(p?.prazo)}
                          </span>
                          {"\n                    "}
                        </button>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <article style={{"minWidth":"0","border":"1px solid var(--rule)","padding":"22px","display":"flex","flexDirection":"column","gap":"16px","borderRadius":"14px","overflow":"hidden"}}>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                        <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"28px","lineHeight":"1.15"}}>
                          {__t($v.apSel?.titulo)}
                        </h2>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {__t($v.apSel?.tipo)}
                        </span>
                      </div>
                      {"\n                  "}
                      <dl style={{"margin":"0","display":"grid","gridTemplateColumns":"repeat(auto-fill, minmax(180px, 1fr))","gap":"14px"}}>
                        {"\n                    "}
                        <div>
                          <dt style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Solicitante"}
                          </dt>
                          <dd style={{"margin":"0","fontSize":"14px"}}>
                            {__t($v.apSel?.solicitante)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Agente responsável"}
                          </dt>
                          <dd style={{"margin":"0","fontSize":"14px"}}>
                            {__t($v.apSel?.agenteNome)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Prazo"}
                          </dt>
                          <dd style={{"margin":"0","fontSize":"14px"}}>
                            {__t($v.apSel?.prazo)}
                          </dd>
                        </div>
                        {"\n                    "}
                        <div>
                          <dt style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Créditos estimados"}
                          </dt>
                          <dd style={{"margin":"0","fontSize":"14px"}}>
                            {__t($v.apSel?.creditos)}
                          </dd>
                        </div>
                        {"\n                  "}
                      </dl>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Motivo"}
                        </span>
                        <span style={{"fontSize":"15px"}}>
                          {__t($v.apSel?.motivo)}
                        </span>
                      </div>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Impacto"}
                        </span>
                        <span style={{"fontSize":"15px"}}>
                          {__t($v.apSel?.impacto)}
                        </span>
                      </div>
                      {"\n                  "}
                      <div style={{"padding":"14px 16px","background":"var(--mist)","display":"flex","flexDirection":"column","gap":"4px"}}>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Prévia"}
                        </span>
                        <span style={{"fontSize":"15px","textWrap":"pretty"}}>
                          {__t($v.apSel?.previa)}
                        </span>
                      </div>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                        {"\n                    "}
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Histórico"}
                        </span>
                        {"\n                    "}
                        <ol className={"tl tl-h tl-lead"} aria-label="Ciclo da aprovação">
                          {"\n                      "}
                          {__arr($v.apSel?.fasesAp).map((f, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <li className={"tl-item"} data-done={f?.done} data-state={f?.st}>
                              {"\n                          "}
                              <time className={"tl-date"}>
                                {__t(f?.quando)}
                              </time>
                              {"\n                          "}
                              <span className={"tl-sep"}></span>
                              {"\n                          "}
                              <span className={"tl-ind"}></span>
                              {"\n                          "}
                              <span className={"tl-title"}>
                                {__t(f?.label)}
                              </span>
                              {"\n                          "}
                              <span className={"tl-content"}>
                                {__t(f?.det)}
                              </span>
                              {"\n                        "}
                            </li>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </ol>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      {$v.apSel?.decidida ? (<>
                        {"\n                    "}
                        <div role="status" style={__css(`padding: 12px 14px; border: 1px solid ${__s($v.apSel?.corDecisao)}; display: flex; gap: 10px; align-items: center; font-size: 14px; border-radius: 14px; overflow: hidden;`)}>
                          <span style={__css(`width: 8px; height: 8px; border-radius: 50%; background: ${__s($v.apSel?.corDecisao)};`)}></span>
                          {__t($v.apSel?.decisao)}{" por "}{__t($v.usuario?.usuario)}
                        </div>
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      {$v.apSel?.semAlcada ? (<>
                        <div role="note" style={{"display":"flex","alignItems":"center","gap":"8px","padding":"12px 14px","borderRadius":"14px","background":"var(--mist)","fontSize":"13px","lineHeight":"1.5"}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                          </svg>
                          {"Esta aprovação mexe com dinheiro do cliente. Quem decide é o C-level ou o superadmin; você acompanha por aqui."}
                        </div>
                      </>) : null}
                      {"\n                  "}
                      {$v.apSel?.podeDecidir ? (<>
                        {"\n                    "}
                        {$v.ajusteAberto ? (<>
                          {"\n                      "}
                          <label style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                            <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                              {"O que precisa mudar"}
                            </span>
                            {"\n                        "}
                            <textarea value={__val($v.ajusteTexto)} onChange={$v.mudarAjuste} rows="3" style={{"border":"1px solid var(--steel)","padding":"10px 12px","fontFamily":"inherit","fontWeight":"400","fontSize":"14px","resize":"vertical","outline":"none","borderRadius":"10px"}}></textarea>
                            {"\n                      "}
                          </label>
                          {"\n                      "}
                          {$v.ajusteErro ? (<>
                            <span role="alert" style={{"fontSize":"14px","color":"var(--err)"}}>
                              {"Descreva o ajuste antes de enviar."}
                            </span>
                          </>) : null}
                          {"\n                    "}
                        </>) : null}
                        {"\n                    "}
                        <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                          {"\n                      "}
                          <button className={"b-pri"} onClick={$v.aprovar} style={{"minHeight":"44px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                            {"Aprovar"}
                          </button>
                          {"\n                      "}
                          <button className={"b-sec"} onClick={$v.pedirAjuste} style={{"minHeight":"44px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                            {__t($v.rotuloAjuste)}
                          </button>
                          {"\n                      "}
                          <button className={"b-sec"} onClick={$v.rejeitar} style={{"minHeight":"44px","padding":"0 18px","border":"1px solid var(--err)","background":"var(--paper)","color":"var(--err)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                            {"Rejeitar"}
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </>) : null}
                      {"\n                "}
                    </article>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.vCanal ? (<>
              {"\n          "}
              <div style={{"minHeight":"100%","display":"flex","flexDirection":"column"}}>
                {"\n            "}
                <div className={"canal-bar"}>
                  {"\n              "}
                  <span className={"pilha"}>
                    {__arr($v.cn?.fotos).map((ft, $index) => (<React.Fragment key={$index}>
                      <span className={"membro-av canal-av"}>
                        {__t(ft?.sigla)}
                        {ft?.tem ? (<>
                          <img className={"foto"} src={ft?.src} alt="" />
                        </>) : null}
                      </span>
                    </React.Fragment>))}
                  </span>
                  {"\n              "}
                  <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                    {__t($v.cn?.pessoasTexto)}
                  </span>
                  {"\n              "}
                  <span className={"tb-sep"} aria-hidden="true"></span>
                  {"\n              "}
                  {__arr($v.cn?.agentes).map((ag, $index) => (<React.Fragment key={$index}>
                    <span className={"canal-ag"}>
                      <span className={"msg-av msg-av-agente"} style={{"width":"20px","height":"20px","fontSize":"9px","borderRadius":"5px"}}>
                        {__t(ag?.sigla)}
                      </span>
                      {__t(ag?.nome)}
                    </span>
                  </React.Fragment>))}
                  {"\n              "}
                  {$v.cn?.semAgentes ? (<>
                    <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                      {"Nenhum agente neste canal"}
                    </span>
                  </>) : null}
                  {"\n              "}
                  <span style={{"flex":"1 1 auto"}}></span>
                  {"\n              "}
                  <button className={"b-sec mini-btn"} onClick={$v.cn?.gerenciar} disabled={$v.cn?.naoGere}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"></path>
                    </svg>
                    {"Pessoas e agentes"}
                  </button>
                  {"\n            "}
                </div>
                {"\n            "}
                <div style={{"flex":"1 1 auto","padding":"20px 24px","display":"flex","flexDirection":"column","gap":"0"}}>
                  {"\n              "}
                  <div style={{"display":"flex","alignItems":"center","gap":"12px","fontSize":"13px","color":"var(--graphite)"}}>
                    <span style={{"flex":"1 1 auto","height":"1px","background":"var(--rule)"}}></span>
                    {"Hoje"}
                    <span style={{"flex":"1 1 auto","height":"1px","background":"var(--rule)"}}></span>
                  </div>
                  {"\n              "}
                  {__arr($v.canalMsgs).map((m, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <div className={"cmsg"} tabIndex="0" onMouseEnter={m?.entrar} onMouseLeave={m?.sair} onFocus={m?.entrar} style={__css(`position: relative; padding: ${__s(m?.pad)}; margin: 0 -12px; padding-left: 12px; padding-right: 12px; border-radius: 12px; background: ${__s(m?.fundo)}; transition: background-color 0.15s ease-out;`)}>
                      {"\n                  "}
                      <div className={"msg"} data-align={m?.align}>
                        {"\n                    "}
                        <span className={`msg-av ${__s(m?.avCls)}`} style={__css(`visibility: ${__s(m?.avVis)}; margin-bottom: ${__s(m?.avMb)};`)} aria-hidden="true">
                          {__t(m?.sigla)}
                        </span>
                        {"\n                    "}
                        <div className={"msg-body"} style={{"position":"relative","maxWidth":"min(72%, 760px)"}}>
                          {"\n                      "}
                          {m?.cabeca ? (<>
                            {"\n                        "}
                            <span className={"msg-head"}>
                              <b>
                                {__t(m?.autor)}
                              </b>
                              {m?.agente ? (<>
                                <span className={"msg-tag"}>
                                  {"agente"}
                                </span>
                              </>) : null}
                              <span>
                                {__t(m?.hora)}
                              </span>
                            </span>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.temCitacao ? (<>
                            {"\n                        "}
                            <span className={"quote"}>
                              <b>
                                {__t(m?.citAutor)}
                              </b>
                              <span>
                                {__t(m?.citTexto)}
                              </span>
                            </span>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.naoEditando ? (<>
                            {"\n                        "}
                            <div className={`bubble ${__s(m?.bubbleCls)}`} title={m?.hora}>
                              {__t(m?.texto)}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.editando ? (<>
                            {"\n                        "}
                            <div className={"edit-box"}>
                              {"\n                          "}
                              <label>
                                <span style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                                  {"Editar mensagem"}
                                </span>
                                {"\n                            "}
                                <textarea ref={$v.refEdit} value={__val($v.editTexto)} onChange={$v.mudarEdit} onKeyDown={$v.teclaEdit} rows="2"></textarea>
                                {"\n                          "}
                              </label>
                              {"\n                          "}
                              <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                                {"\n                            "}
                                <span style={{"flex":"1 1 auto","fontSize":"12px","color":"var(--graphite)"}}>
                                  {"Enter salva · Esc cancela"}
                                </span>
                                {"\n                            "}
                                <button className={"b-sec"} onClick={$v.cancelarEdit} style={{"height":"32px","padding":"0 12px","border":"1px solid var(--rule)","borderRadius":"8px","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer"}}>
                                  {"Cancelar"}
                                </button>
                                {"\n                            "}
                                <button className={"b-pri"} onClick={$v.salvarEdit} style={{"height":"32px","padding":"0 14px","border":"1px solid var(--ink)","borderRadius":"8px","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer"}}>
                                  {"Salvar"}
                                </button>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </div>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.temCard ? (<>
                            {"\n                        "}
                            <a className={"attach"} href={m?.cardHref} aria-label="Abrir dossiê da Serra Azul Têxtil">
                              {"\n                          "}
                              <span className={"attach-ico"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M14 3H6v18h12V7z"></path>
                                  <path d="M14 3v4h4"></path>
                                  <path d="M9 12h6M9 16h6"></path>
                                </svg>
                              </span>
                              {"\n                          "}
                              <span style={{"minWidth":"0"}}>
                                <span className={"attach-nome"}>
                                  {"Dossiê · Serra Azul Têxtil"}
                                </span>
                                <span className={"attach-sub"}>
                                  {"Vaga aberta · Gerente de Importação · São Paulo"}
                                </span>
                              </span>
                              {"\n                          "}
                              <span className={"attach-fit"}>
                                {"96"}
                                <small>
                                  {"fit"}
                                </small>
                              </span>
                              {"\n                        "}
                            </a>
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {m?.temRodape ? (<>
                            {"\n                        "}
                            <span className={"msg-foot"} style={{"flexWrap":"wrap"}}>
                              {"\n                          "}
                              {__arr(m?.reacoes).map((rc, $index) => (<React.Fragment key={$index}>
                                {"\n                            "}
                                <button className={"react-chip"} onClick={rc?.alternar} aria-pressed={rc?.minha} aria-label={rc?.rotulo} title={rc?.quem}>
                                  <span className={"react-emoji"}>
                                    {__t(rc?.emoji)}
                                  </span>
                                  <span>
                                    {__t(rc?.n)}
                                  </span>
                                </button>
                                {"\n                          "}
                              </React.Fragment>))}
                              {"\n                          "}
                              {m?.temReacoes ? (<>
                                {"\n                            "}
                                <button className={"react-chip react-add"} onClick={m?.abrirPicker} aria-label="Adicionar reação" title="Adicionar reação">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20.5 12a8.5 8.5 0 1 1-6.2-8.2"></path>
                                    <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"></path>
                                    <path d="M9 9.5h.01M15 9.5h.01"></path>
                                    <path d="M19 2.5v5M16.5 5h5"></path>
                                  </svg>
                                </button>
                                {"\n                          "}
                              </>) : null}
                              {"\n                          "}
                              {m?.editada ? (<>
                                <span>
                                  {"Editada"}
                                </span>
                              </>) : null}
                              {"\n                          "}
                              {m?.temStatus ? (<>
                                <span style={{"display":"inline-flex","alignItems":"center","gap":"4px"}}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                                  </svg>
                                  {__t(m?.status)}
                                </span>
                              </>) : null}
                              {"\n                        "}
                            </span>
                            {"\n                      "}
                          </>) : null}
                          {"\n                  "}
                          {m?.barra ? (<>
                            {"\n                    "}
                            <div className={"msg-toolbar"} role="toolbar" aria-label="Ações da mensagem">
                              {"\n                      "}
                              {__arr(m?.rapidas).map((q, $index) => (<React.Fragment key={$index}>
                                {"\n                        "}
                                <button className={"tb-emoji"} onClick={q?.reagir} aria-pressed={q?.minha} aria-label={q?.rotulo} title={q?.rotulo}>
                                  {__t(q?.emoji)}
                                </button>
                                {"\n                      "}
                              </React.Fragment>))}
                              {"\n                      "}
                              <button className={"tb-btn"} onClick={m?.abrirPicker} aria-expanded={m?.pickerAberto} aria-label="Mais reações" title="Mais reações">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M20.5 12a8.5 8.5 0 1 1-6.2-8.2"></path>
                                  <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"></path>
                                  <path d="M9 9.5h.01M15 9.5h.01"></path>
                                  <path d="M19 2.5v5M16.5 5h5"></path>
                                </svg>
                              </button>
                              {"\n                      "}
                              <span className={"tb-sep"} aria-hidden="true"></span>
                              {"\n                      "}
                              <button className={"tb-btn"} onClick={m?.responder} aria-label="Responder" title="Responder">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M9 7L4 12l5 5"></path>
                                  <path d="M4 12h10a6 6 0 0 1 6 6v1"></path>
                                </svg>
                              </button>
                              {"\n                      "}
                              {m?.podeEditar ? (<>
                                <button className={"tb-btn"} onClick={m?.editar} aria-label="Editar mensagem" title="Editar">
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M14.5 5.5l4 4"></path>
                                    <path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"></path>
                                  </svg>
                                </button>
                              </>) : null}
                              {"\n                      "}
                              <button className={"tb-btn"} onClick={m?.delegar} aria-label="Pedir a um agente" title="Pedir a um agente">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="4" y="7" width="16" height="12" rx="3"></rect>
                                  <path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5h5"></path>
                                </svg>
                              </button>
                              {"\n                      "}
                              {m?.pickerAberto ? (<>
                                {"\n                        "}
                                <div className={"react-picker"} role="dialog" aria-label="Mais reações">
                                  {"\n                          "}
                                  {__arr(m?.todas).map((q, $index) => (<React.Fragment key={$index}>
                                    {"\n                            "}
                                    <button className={"tb-emoji"} onClick={q?.reagir} aria-pressed={q?.minha} aria-label={q?.rotulo} title={q?.rotulo}>
                                      {__t(q?.emoji)}
                                    </button>
                                    {"\n                          "}
                                  </React.Fragment>))}
                                  {"\n                        "}
                                </div>
                                {"\n                      "}
                              </>) : null}
                              {"\n                    "}
                            </div>
                            {"\n                  "}
                          </>) : null}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n              "}
                  {$v.digitando ? (<>
                    {"\n                "}
                    <div className={"msg"} role="status" style={{"padding":"14px 0 4px"}}>
                      {"\n                  "}
                      <span className={"msg-av msg-av-agente"}>
                        {__t($v.digitandoSigla)}
                      </span>
                      {"\n                  "}
                      <div className={"msg-body"}>
                        {"\n                    "}
                        <span className={"msg-head"}>
                          <b>
                            {__t($v.digitandoNome)}
                          </b>
                          <span>
                            {"está escrevendo"}
                          </span>
                        </span>
                        {"\n                    "}
                        <div className={"bubble bubble-muted"} style={{"padding":"10px 14px","color":"var(--ink)"}}>
                          <span className={"ld-linear-dots"} aria-hidden="true" style={{"--ld-size":"18px"}}>
                            <span className={"ld-linear-dots-dot"}></span>
                            <span className={"ld-linear-dots-dot"}></span>
                            <span className={"ld-linear-dots-dot"}></span>
                          </span>
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </>) : null}
                  {"\n            "}
                </div>
                {"\n            "}
                <div style={{"position":"sticky","bottom":"0","zIndex":"4","background":"var(--paper)","padding":"0 24px 20px"}}>
                  {"\n              "}
                  <div style={{"border":"1px solid var(--rule)","padding":"12px 14px 10px","display":"flex","flexDirection":"column","gap":"10px","background":"var(--paper)","borderRadius":"14px","overflow":"hidden"}}>
                    {"\n                "}
                    {$v.respondendo ? (<>
                      <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"6px 10px","background":"var(--mist)","fontSize":"13px","color":"var(--text-2)"}}>
                        <span style={{"width":"2px","alignSelf":"stretch","background":"var(--ink)"}}></span>
                        <span style={{"flex":"1 1 auto","minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                          {"Respondendo a "}{__t($v.respondendoNome)}
                        </span>
                        <button className={"b-ghost"} onClick={$v.cancelarResposta} aria-label="Cancelar resposta" style={{"width":"28px","height":"28px","border":"none","background":"transparent","display":"grid","placeItems":"center","color":"var(--ink)","cursor":"pointer"}}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18"></path>
                          </svg>
                        </button>
                      </div>
                    </>) : null}
                    {"\n                "}
                    <label>
                      <span style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                        {"Mensagem"}
                      </span>
                      {"\n                  "}
                      <textarea ref={$v.refCanalInput} value={__val($v.canalTexto)} onChange={$v.mudarCanalTexto} onKeyDown={$v.teclaCanal} placeholder={`Mensagem em # ${__s($v.canalNome)} — use @ para chamar um agente`} style={{"width":"100%","boxSizing":"border-box","resize":"none","minHeight":"52px","border":"none","outline":"none","background":"transparent","color":"var(--ink)","fontFamily":"inherit","fontWeight":"400","fontSize":"14px","lineHeight":"1.5"}}></textarea>
                      {"\n                "}
                    </label>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"center","gap":"8px"}}>
                      {"\n                  "}
                      <button className={"b-sec"} onClick={$v.abrirCopiloto} style={{"height":"36px","padding":"0 12px","border":"1px solid var(--rule)","background":"var(--paper)","color":"var(--ink)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                        {"@ Agentes"}
                      </button>
                      {"\n                  "}
                      <span style={{"flex":"1 1 auto"}}></span>
                      {"\n                  "}
                      <button className={"b-pri"} onClick={$v.enviarCanal} style={{"height":"40px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                        {"Enviar"}
                      </button>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </div>
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n\n        "}
            {$v.vConfig ? (<>
              {"\n          "}
              <div className={"cfg"}>
                {"\n            "}
                <nav className={"cfg-nav"} aria-label="Seções de configurações">
                  {"\n              "}
                  {__arr($v.secoes).map((s, $index) => (<React.Fragment key={$index}>
                    {"\n                "}
                    <button className={"navrow cfg-nav-btn"} onClick={s?.ir} aria-current={s?.ativo}>
                      <span>
                        {__t(s?.nome)}
                      </span>
                      <span className={"cfg-nav-sub"}>
                        {__t(s?.sub)}
                      </span>
                    </button>
                    {"\n              "}
                  </React.Fragment>))}
                  {"\n            "}
                </nav>
                {"\n            "}
                <div className={"cfg-corpo"}>
                  {"\n              "}
                  <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"300","fontSize":"30px"}}>
                      {__t($v.secaoAtual)}
                    </h2>
                    <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                      {__t($v.secaoDesc)}
                    </span>
                  </div>
                  {"\n              "}
                  {$v.cfgAviso ? (<>
                    <div className={"cfg-aviso"} role="status">
                      {__t($v.cfgAvisoTexto)}
                    </div>
                  </>) : null}
                  {"\n\n              "}
                  {$v.cfgConta ? (<>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        {"Foto e dados"}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row"} style={{"gap":"18px","alignItems":"center"}}>
                        {"\n                    "}
                        <span className={"cfg-avatar"}>
                          {__t($v.usuario?.sigla)}
                          {$v.temMinhaFoto ? (<>
                            <img className={"foto"} src={$v.minhaFoto} alt="Sua foto" />
                          </>) : null}
                        </span>
                        {"\n                    "}
                        <div style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                          {"\n                      "}
                          <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                            {"\n                        "}
                            <label className={"b-sec mini-btn"} style={{"cursor":"pointer"}}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z"></path>
                                <circle cx="12" cy="13" r="3.5"></circle>
                              </svg>
                              {"Trocar foto"}
                              <input type="file" accept="image/png, image/jpeg, image/webp" onChange={$v.conta?.trocarFoto} style={{"position":"absolute","width":"1px","height":"1px","opacity":"0"}} />
                            </label>
                            {"\n                        "}
                            {$v.temMinhaFoto ? (<>
                              <button className={"b-sec mini-btn"} onClick={$v.conta?.removerFoto}>
                                {"Remover"}
                              </button>
                            </>) : null}
                            {"\n                      "}
                          </div>
                          {"\n                      "}
                          <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                            {"PNG ou JPG, até 2 MB. Aparece para o time e nos canais."}
                          </span>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-grid"}>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Nome"}
                          </span>
                          <input value={__val($v.conta?.nome)} onChange={$v.conta?.mudarNome} />
                        </label>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Cargo"}
                          </span>
                          <input value={__val($v.conta?.cargo)} onChange={$v.conta?.mudarCargo} placeholder="Ex.: Estrategista de receita" />
                        </label>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"E-mail de acesso"}
                          </span>
                          <input value={__val($v.usuario?.email)} readOnly="" aria-readonly="true" />
                          <em>
                            {"Para trocar o e-mail, fale com o administrador do workspace."}
                          </em>
                        </label>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Telefone"}
                          </span>
                          <input type="tel" value={__val($v.conta?.fone)} onChange={$v.conta?.mudarFone} placeholder="(11) 90000-0000" />
                        </label>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-acoes"}>
                        <button className={"b-pri cfg-salvar"} onClick={$v.conta?.salvar}>
                          {"Salvar alterações"}
                        </button>
                      </div>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span style={{"display":"inline-flex","alignItems":"center","gap":"6px"}}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                          </svg>
                          {"Senha e segurança"}
                        </span>
                      </div>
                      {"\n                  "}
                      <div className={"cfg-grid"}>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Senha atual"}
                          </span>
                          <input type="password" autoComplete="current-password" value={__val($v.conta?.senhaAtual)} onChange={$v.conta?.mudarSenhaAtual} />
                        </label>
                        {"\n                    "}
                        <span></span>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Nova senha"}
                          </span>
                          <input type="password" autoComplete="new-password" value={__val($v.conta?.senhaNova)} onChange={$v.conta?.mudarSenhaNova} />
                          <em>
                            {__t($v.conta?.forcaTexto)}
                          </em>
                        </label>
                        {"\n                    "}
                        <label className={"cfg-campo"}>
                          <span>
                            {"Confirmar nova senha"}
                          </span>
                          <input type="password" autoComplete="new-password" value={__val($v.conta?.senhaConf)} onChange={$v.conta?.mudarSenhaConf} />
                        </label>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      {$v.conta?.temErroSenha ? (<>
                        <div className={"cfg-erro"} role="alert">
                          {__t($v.conta?.erroSenha)}
                        </div>
                      </>) : null}
                      {"\n                  "}
                      <div className={"cfg-acoes"}>
                        <button className={"b-sec mini-btn"} onClick={$v.conta?.alterarSenha} style={{"height":"38px"}}>
                          {"Alterar senha"}
                        </button>
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"}>
                        <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Verificação em duas etapas"}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Pede um código do app autenticador a cada novo login."}
                          </span>
                        </span>
                        <button className={"switch"} role="switch" aria-checked={$v.conta?.doisFatores} aria-label="Verificação em duas etapas" onClick={$v.conta?.alternar2fa}>
                          <span></span>
                        </button>
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"}>
                        <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Sessões ativas"}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Este navegador · São Paulo · agora"}
                          </span>
                        </span>
                        <button className={"b-sec mini-btn"} onClick={$v.conta?.sairOutras}>
                          {"Sair dos outros dispositivos"}
                        </button>
                      </div>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </>) : null}
                  {"\n\n              "}
                  {$v.cfgWs ? (<>
                    {"\n                "}
                    {$v.ws2?.podeTrocar ? (<>
                      {"\n                  "}
                      <div className={"chips"} role="radiogroup" aria-label="Workspace">
                        {__arr($v.ws2?.lista).map((w, $index) => (<React.Fragment key={$index}>
                          <button className={"chip"} role="radio" aria-checked={w?.ativo} aria-pressed={w?.ativo} onClick={w?.escolher}>
                            {__t(w?.nome)}
                          </button>
                        </React.Fragment>))}
                      </div>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-row"} style={{"gap":"16px","alignItems":"center"}}>
                        {"\n                    "}
                        <span className={"cfg-ws-logo"} style={{"position":"relative","overflow":"hidden"}}>
                          {$v.ws2?.logoSem ? (<>
                            {__t($v.ws2?.sigla)}
                          </>) : null}
                          {$v.ws2?.logoTem ? (<>
                            <img className={"ws-img"} src={$v.ws2?.logo} onError={$v.ws2?.logoErro} onLoad={$v.ws2?.logoLoad} alt={`Logo de ${__s($v.ws2?.nome)}`} />
                          </>) : null}
                        </span>
                        {"\n                    "}
                        <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontFamily":"var(--f-display)","fontSize":"22px"}}>
                            {__t($v.ws2?.nome)}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t($v.ws2?.resumo)}
                          </span>
                        </span>
                        {"\n                    "}
                        <span style={{"display":"flex","alignItems":"center","gap":"8px","fontSize":"13px"}}>
                          <img className={"foto foto-sm"} src={$v.ws2?.donoFoto} alt="" />
                          <span style={{"display":"flex","flexDirection":"column"}}>
                            <span style={{"color":"var(--graphite)","fontSize":"12px"}}>
                              {"Dono do workspace"}
                            </span>
                            <span style={{"fontWeight":"500"}}>
                              {__t($v.ws2?.dono)}
                            </span>
                          </span>
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"} style={{"gap":"10px","alignItems":"center"}}>
                        {"\n                    "}
                        <span style={{"display":"flex","flexDirection":"column","gap":"2px","flex":"1 1 200px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Logo do workspace"}
                          </span>
                          <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                            {__t($v.ws2?.logoOrigem)}{". Aparece para todo o time na barra lateral."}
                          </span>
                        </span>
                        {"\n                    "}
                        {$v.ws2?.podeMarca ? (<>
                          {"\n                      "}
                          {$v.ws2?.siteNaoEditando ? (<>
                            {"\n                        "}
                            <label className={"b-sec mini-btn"} style={{"cursor":"pointer","position":"relative"}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 16V4M7 9l5-5 5 5"></path>
                                <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3"></path>
                              </svg>
                              {"Enviar imagem"}
                              <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={$v.ws2?.logoArquivo} style={{"position":"absolute","width":"1px","height":"1px","opacity":"0"}} aria-label="Enviar logo do workspace" />
                            </label>
                            {"\n                        "}
                            <button className={"b-sec mini-btn"} onClick={$v.ws2?.siteEditar}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="8.5"></circle>
                                <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"></path>
                              </svg>
                              {"Puxar do site"}
                            </button>
                            {"\n                        "}
                            {$v.ws2?.temLogoProprio ? (<>
                              <button className={"b-ghost mini-btn"} onClick={$v.ws2?.logoRemover}>
                                {"Remover"}
                              </button>
                            </>) : null}
                            {"\n                      "}
                          </>) : null}
                          {"\n                      "}
                          {$v.ws2?.siteEditando ? (<>
                            {"\n                        "}
                            <span className={"cad-field"} style={{"flex":"1 1 220px","height":"36px"}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="8.5"></circle>
                                <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"></path>
                              </svg>
                              <input value={__val($v.ws2?.siteRascunho)} onChange={$v.ws2?.siteMudar} onKeyDown={$v.ws2?.siteTecla} placeholder="empresa.com.br" aria-label="Site do workspace" />
                            </span>
                            {"\n                        "}
                            <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={$v.ws2?.siteSalvar}>
                              {"Puxar logo"}
                            </button>
                            {"\n                        "}
                            <button className={"b-ghost mini-btn"} onClick={$v.ws2?.siteCancelar}>
                              {"Cancelar"}
                            </button>
                            {"\n                        "}
                            {$v.ws2?.siteTemErro ? (<>
                              <span style={{"flexBasis":"100%","fontSize":"12px","color":"var(--err)"}}>
                                {__t($v.ws2?.siteErro)}
                              </span>
                            </>) : null}
                            {"\n                      "}
                          </>) : null}
                          {"\n                    "}
                        </>) : null}
                        {"\n                    "}
                        {$v.ws2?.naoPodeMarca ? (<>
                          <span style={{"display":"inline-flex","alignItems":"center","gap":"6px","fontSize":"12px","color":"var(--graphite)"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                            </svg>
                            {"Superadmin, estrategista ou C-level trocam o logo"}
                          </span>
                        </>) : null}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Papéis"}
                        </span>
                        <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                          {"Cada pessoa tem um papel por workspace"}
                        </span>
                      </div>
                      {"\n                  "}
                      <div className={"papeis"}>
                        {"\n                    "}
                        {__arr($v.ws2?.papeis).map((p, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div className={"papel"} data-meu={p?.meu}>
                            <span className={"papel-n"} style={__css(`background: ${__s(p?.cor)};`)}></span>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(p?.nome)}
                            </span>
                            <span style={{"fontSize":"12px","color":"var(--graphite)","lineHeight":"1.45"}}>
                              {__t(p?.desc)}
                            </span>
                            <span style={{"fontSize":"11px","color":"var(--muted)"}}>
                              {__t(p?.quem)}
                            </span>
                          </div>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"O que cada papel pode fazer"}
                        </span>
                        <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                          {"a mesma regra vale na tela e nos agentes"}
                        </span>
                      </div>
                      {"\n                  "}
                      <div className={"mz"} role="table" aria-label="Permissões por papel">
                        {"\n                    "}
                        <div className={"mz-l mz-h"} role="row">
                          <span role="columnheader">
                            {"Capacidade"}
                          </span>
                          {__arr($v.ws2?.matriz?.papeis).map((p, $index) => (<React.Fragment key={$index}>
                            <span className={"mz-c"} role="columnheader" data-meu={p?.meu}>
                              {__t(p?.nome)}
                            </span>
                          </React.Fragment>))}
                        </div>
                        {"\n                    "}
                        {__arr($v.ws2?.matriz?.grupos).map((g, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div className={"mz-g"} role="row">
                            <span role="cell">
                              {__t(g?.nome)}
                            </span>
                          </div>
                          {"\n                      "}
                          {__arr(g?.itens).map((c, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <div className={"mz-l"} role="row">
                              <span role="cell" style={{"display":"flex","flexDirection":"column","gap":"2px"}}>
                                <span>
                                  {__t(c?.nome)}
                                </span>
                                {c?.temNota ? (<>
                                  <span style={{"fontSize":"11px","color":"var(--graphite)","lineHeight":"1.4"}}>
                                    {__t(c?.nota)}
                                  </span>
                                </>) : null}
                              </span>
                              {__arr(c?.cels).map((x, $index) => (<React.Fragment key={$index}>
                                <span className={"mz-c"} role="cell" data-meu={x?.meu}>
                                  <span className={"mz-v"} data-k={x?.k}>
                                    {__t(x?.t)}
                                  </span>
                                </span>
                              </React.Fragment>))}
                            </div>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <span style={{"display":"block","padding":"10px 16px 14px","fontSize":"12px","color":"var(--graphite)"}}>
                        {"Só o seu: vale para contas, negócios, canais e cadências em que a pessoa é responsável. Pede: a ação vira pedido para quem decide, em Aprovações."}
                      </span>
                      {"\n                "}
                    </section>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Membros"}
                        </span>
                        <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                          {__t($v.ws2?.contagem)}
                        </span>
                      </div>
                      {"\n                  "}
                      {$v.ws2?.podeConvidar ? (<>
                        {"\n                    "}
                        <div className={"convite"}>
                          {"\n                      "}
                          <label className={"cad-field"} style={{"flex":"1 1 260px"}}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect>
                              <path d="M4 7l8 6 8-6"></path>
                            </svg>
                            <input type="email" value={__val($v.ws2?.conviteEmail)} onChange={$v.ws2?.mudarConvite} onKeyDown={$v.ws2?.teclaConvite} placeholder="nome@empresa.com.br" aria-label="E-mail do convidado" />
                          </label>
                          {"\n                      "}
                          <div className={"seg seg-li"} role="radiogroup" aria-label="Papel do convidado">
                            {__arr($v.ws2?.papeisConvite).map((o, $index) => (<React.Fragment key={$index}>
                              <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                {__t(o?.label)}
                              </button>
                            </React.Fragment>))}
                          </div>
                          {"\n                      "}
                          <button className={"b-pri cfg-salvar"} onClick={$v.ws2?.convidar}>
                            {"Enviar convite"}
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        {$v.ws2?.temErroConvite ? (<>
                          <div className={"cfg-erro"} role="alert" style={{"margin":"0 16px 12px"}}>
                            {__t($v.ws2?.erroConvite)}
                          </div>
                        </>) : null}
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      {$v.ws2?.semPermissao ? (<>
                        <div className={"cfg-row"} style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Seu papel pode ver os membros, mas só administradores convidam e trocam papéis."}
                        </div>
                      </>) : null}
                      {"\n                  "}
                      <div className={"membros"}>
                        {"\n                    "}
                        {__arr($v.ws2?.membros).map((m, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div className={"membro"} data-pendente={m?.pendente}>
                            {"\n                        "}
                            <span className={"membro-av"}>
                              {__t(m?.sigla)}
                              {m?.temFoto ? (<>
                                <img className={"foto"} src={m?.foto} alt="" />
                              </>) : null}
                            </span>
                            {"\n                        "}
                            <span style={{"flex":"1 1 200px","minWidth":"0","display":"flex","flexDirection":"column","gap":"1px"}}>
                              <span style={{"fontSize":"14px","fontWeight":"500"}}>
                                {__t(m?.nome)}
                                {m?.voce ? (<>
                                  <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                                    {" · você"}
                                  </span>
                                </>) : null}
                              </span>
                              <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                {__t(m?.email)}{" · "}{__t(m?.origem)}
                              </span>
                            </span>
                            {"\n                        "}
                            {m?.pendente ? (<>
                              <span className={"con-tag"} style={{"color":"var(--warn)","background":"color-mix(in srgb, var(--warn) 14%, transparent)"}}>
                                {"Convite enviado "}{__t(m?.quando)}
                              </span>
                            </>) : null}
                            {"\n                        "}
                            {m?.editavel ? (<>
                              {"\n                          "}
                              <select className={"cfg-select"} value={__val(m?.papel)} onChange={m?.mudarPapel} aria-label={`Papel de ${__s(m?.nome)}`}>
                                <option value={__val("superadmin")}>
                                  {"Superadmin"}
                                </option>
                                <option value={__val("estrategista")}>
                                  {"Estrategista"}
                                </option>
                                <option value={__val("cliente")}>
                                  {"C-level"}
                                </option>
                                <option value={__val("bdr")}>
                                  {"BDR/SDR"}
                                </option>
                              </select>
                              {"\n                        "}
                            </>) : null}
                            {"\n                        "}
                            {m?.fixo ? (<>
                              <span className={"papel-tag"}>
                                <span className={"papel-n"} style={__css(`background: ${__s(m?.cor)};`)}></span>
                                {__t(m?.papelNome)}
                              </span>
                            </>) : null}
                            {"\n                        "}
                            {m?.pendente ? (<>
                              {m?.removivel ? (<>
                                <button className={"b-sec mini-btn"} onClick={m?.reenviar}>
                                  {"Reenviar"}
                                </button>
                              </>) : null}
                            </>) : null}
                            {"\n                        "}
                            {m?.removivel ? (<>
                              <button className={"icon-btn"} onClick={m?.remover} aria-label={m?.removerRotulo} title={m?.removerRotulo}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M6 6l12 12M18 6L6 18"></path>
                                </svg>
                              </button>
                            </>) : null}
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </>) : null}
                  {"\n\n              "}
                  {$v.cfgAparencia ? (<>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"} style={{"borderTop":"none"}}>
                        <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Tema"}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Sistema acompanha o claro/escuro do seu computador."}
                          </span>
                        </span>
                        <div className={"seg"} role="radiogroup" aria-label="Tema" style={{"width":"280px"}}>
                          {__arr($v.temas).map((t, $index) => (<React.Fragment key={$index}>
                            <button role="radio" aria-checked={t?.ativo} onClick={t?.escolher}>
                              {__t(t?.label)}
                            </button>
                          </React.Fragment>))}
                        </div>
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"}>
                        <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Densidade das listas"}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Compacta mostra mais linhas por tela em contas, tabelas e no menu."}
                          </span>
                        </span>
                        <div className={"seg"} role="radiogroup" aria-label="Densidade" style={{"width":"240px","gridTemplateColumns":"repeat(2, 1fr)"}}>
                          {__arr($v.densidades).map((t, $index) => (<React.Fragment key={$index}>
                            <button role="radio" aria-checked={t?.ativo} onClick={t?.escolher}>
                              {__t(t?.label)}
                            </button>
                          </React.Fragment>))}
                        </div>
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"}>
                        <span style={{"flex":"1 1 auto","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {"Menu lateral recolhido"}
                          </span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {"Mais espaço para o conteúdo. Atalho: "}{__t($v.atalhoNav)}{"."}
                          </span>
                        </span>
                        <button className={"switch"} role="switch" aria-checked={$v.navRecolhido} aria-label="Menu lateral recolhido" onClick={$v.alternarNav}>
                          <span></span>
                        </button>
                      </div>
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </>) : null}
                  {"\n\n              "}
                  {$v.cfgToggles ? (<>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      {__arr($v.opcoes).map((o, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"cfg-row cfg-row-line"}>
                          <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(o?.nome)}
                            </span>
                            <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                              {__t(o?.desc)}
                            </span>
                          </span>
                          <button className={"switch"} role="switch" aria-checked={o?.on} aria-label={o?.nome} onClick={o?.alternar}>
                            <span></span>
                          </button>
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </>) : null}
                  {"\n\n              "}
                  {$v.cfgAgentes ? (<>
                    {"\n                "}
                    <section className={"cfg-box"}>
                      {"\n                  "}
                      {__arr($v.cfgListaAg).map((a, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <a className={"cfg-row cfg-row-line cfg-ag"} href={a?.href}>
                          {"\n                      "}
                          <span style={{"width":"32px","height":"32px","display":"grid","placeItems":"center","background":"var(--ink)","color":"var(--paper)","fontSize":"12px","borderRadius":"7px","flex":"none"}}>
                            {__t(a?.sigla)}
                          </span>
                          {"\n                      "}
                          <span style={{"flex":"1 1 auto","fontSize":"14px","fontWeight":"500"}}>
                            {__t(a?.nome)}
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(a?.autonomia)}
                          </span>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","textDecoration":"underline","textUnderlineOffset":"3px"}}>
                            {__t(a?.acao)}
                          </span>
                          {"\n                    "}
                        </a>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </section>
                    {"\n              "}
                  </>) : null}
                  {"\n            "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.vModulo ? (<>
              {"\n          "}
              <div style={{"padding":"24px 24px 48px","maxWidth":"1400px","display":"flex","flexDirection":"column","gap":"20px"}}>
                {"\n            "}
                {$v.md?.temAvisoMod ? (<>
                  {"\n              "}
                  <div role="status" style={{"padding":"10px 14px","border":"1px solid var(--ok)","fontSize":"14px","display":"flex","gap":"10px","alignItems":"center","borderRadius":"14px","overflow":"hidden"}}>
                    <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"var(--ok)"}}></span>
                    {__t($v.avisoTexto)}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.md?.temKpis ? (<>
                  {"\n              "}
                  <section className={"ledger"} aria-label="Indicadores" style={{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(160px, 1fr))"}}>
                    {"\n                "}
                    {__arr($v.md?.kpis).map((k, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"background":"var(--paper)","padding":"16px 18px","display":"flex","flexDirection":"column","gap":"4px"}}>
                        {"\n                    "}
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {__t(k?.label)}
                        </span>
                        {"\n                    "}
                        <span style={{"fontFamily":"var(--f-display)","fontSize":"30px","lineHeight":"1.05","fontWeight":"400","fontVariantNumeric":"tabular-nums"}}>
                          {__t(k?.valor)}
                        </span>
                        {"\n                    "}
                        <span style={{"fontSize":"13px","color":"var(--graphite)","minHeight":"18px"}}>
                          {__t(k?.delta)}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.md?.temFunil ? (<>
                  {"\n              "}
                  <section aria-label="Funil" style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                      {"Funil do ciclo"}
                    </h2>
                    {"\n                "}
                    {__arr($v.md?.funil).map((f, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"display":"grid","gridTemplateColumns":"minmax(120px, 200px) minmax(0, 1fr) 60px","gap":"12px","alignItems":"center"}}>
                        {"\n                    "}
                        <span style={{"fontSize":"14px"}}>
                          {__t(f?.label)}
                        </span>
                        {"\n                    "}
                        <span style={{"height":"22px","background":"var(--mist)"}}>
                          <span style={__css(`display: block; height: 22px; width: ${__s(f?.pct)}; background: var(--ink);`)}></span>
                        </span>
                        {"\n                    "}
                        <span style={{"fontSize":"14px","textAlign":"right","fontVariantNumeric":"tabular-nums"}}>
                          {__t(f?.n)}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.sigCat?.ativo ? (<>
                  {"\n              "}
                  <section aria-label="Catálogo de sinais" style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"baseline","justifyContent":"space-between","gap":"12px","flexWrap":"wrap"}}>
                      <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"22px"}}>
                        {"Catálogo de sinais"}
                      </h2>
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t($v.sigCat?.resumo)}
                      </span>
                    </div>
                    {"\n                "}
                    <div className={"sig-cols"}>
                      {"\n                  "}
                      {__arr($v.sigCat?.grupos).map((g, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"cfg-box"}>
                          {"\n                      "}
                          <div className={"cfg-box-h"}>
                            <a href={g?.href} style={{"display":"inline-flex","alignItems":"center","gap":"8px"}}>
                              <span className={"ag4-tile"} style={{"width":"24px","height":"24px","fontSize":"10px","borderRadius":"6px"}}>
                                {__t(g?.sigla)}
                              </span>
                              {__t(g?.nome)}
                            </a>
                            <span style={{"fontWeight":"400","fontSize":"12px","color":"var(--graphite)"}}>
                              {__t(g?.ativos)}
                            </span>
                          </div>
                          {"\n                      "}
                          {__arr(g?.itens).map((s, $index) => (<React.Fragment key={$index}>
                            <div className={"cfg-row cfg-row-line"} style={{"padding":"9px 14px","gap":"10px"}}>
                              <span className={"cop-dot"} style={__css(`background: ${__s(s?.cor)}; width: 7px; height: 7px;`)}></span>
                              <span style={{"flex":"1 1 auto","minWidth":"0","fontSize":"13px"}}>
                                {__t(s?.nome)}
                              </span>
                              <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                {__t(s?.custo)}{" cr"}
                              </span>
                            </div>
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"8px 0 0","fontWeight":"400","fontSize":"18px"}}>
                      {"Sinais encontrados"}
                    </h2>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.cat?.ativo ? (<>
                  {"\n              "}
                  <section aria-label="Conectores" style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"flex-end","justifyContent":"space-between","gap":"12px","flexWrap":"wrap"}}>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"4px"}}>
                        <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"22px"}}>
                          {"Conectores"}
                        </h2>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {__t($v.cat?.resumo)}
                        </span>
                      </div>
                      {"\n                  "}
                      <label className={"cat-busca"}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="6.5"></circle>
                          <path d="M16 16l4 4"></path>
                        </svg>
                        <input value={__val($v.cat?.busca)} onChange={$v.cat?.mudarBusca} placeholder="Buscar conector" aria-label="Buscar conector" />
                      </label>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"chips"} role="radiogroup" aria-label="Categoria">
                      {"\n                  "}
                      {__arr($v.cat?.filtros).map((f, $index) => (<React.Fragment key={$index}>
                        <button className={"chip"} role="radio" aria-checked={f?.ativo} aria-pressed={f?.ativo} onClick={f?.ir}>
                          {__t(f?.label)}{" "}
                          <span style={{"opacity":"0.6"}}>
                            {__t(f?.n)}
                          </span>
                        </button>
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    {__arr($v.cat?.grupos).map((g, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"10px"}}>
                        {"\n                    "}
                        <div style={{"display":"flex","alignItems":"baseline","gap":"10px"}}>
                          <h3 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"17px"}}>
                            {__t(g?.nome)}
                          </h3>
                          <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                            {__t(g?.desc)}
                          </span>
                        </div>
                        {"\n                    "}
                        <div className={"con-grid"}>
                          {"\n                      "}
                          {__arr(g?.itens).map((c, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <div className={"con-card"} data-estado={c?.estado}>
                              {"\n                          "}
                              <span className={"con-logo"}>
                                <img src={c?.logo} alt={`Logo ${__s(c?.nome)}`} />
                              </span>
                              {"\n                          "}
                              <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                                {"\n                            "}
                                <span style={{"display":"flex","alignItems":"center","gap":"6px","flexWrap":"wrap"}}>
                                  <span style={{"fontSize":"14px","fontWeight":"500"}}>
                                    {__t(c?.nome)}
                                  </span>
                                  {c?.conectado ? (<>
                                    <span className={"con-tag con-ok"}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                                      </svg>
                                      {"Conectado"}
                                    </span>
                                  </>) : null}
                                  {c?.erro ? (<>
                                    <span className={"con-tag con-erro"}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M12 4l9 16H3z"></path>
                                        <path d="M12 10v4M12 17.5v.01"></path>
                                      </svg>
                                      {"Reconectar"}
                                    </span>
                                  </>) : null}
                                </span>
                                {"\n                            "}
                                <span style={{"fontSize":"12px","color":"var(--graphite)","lineHeight":"1.4"}}>
                                  {__t(c?.desc)}
                                </span>
                                {"\n                            "}
                                <span className={"con-auth"}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                                  </svg>
                                  {__t(c?.auth)}
                                  {c?.conectado ? (<>
                                    <span aria-hidden="true">
                                      {"·"}
                                    </span>
                                    {__t(c?.usoTexto)}
                                  </>) : null}
                                </span>
                                {"\n                          "}
                              </span>
                              {"\n                          "}
                              <button className={c?.btnCls} onClick={c?.acao} aria-label={c?.acaoRotulo}>
                                {__t(c?.acaoLabel)}
                              </button>
                              {"\n                        "}
                            </div>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n                "}
                    {$v.cat?.vazio ? (<>
                      <div className={"pessoa pessoa-vazia"}>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {"Nenhum conector com esse nome. Peça um novo ao estrategista da Althius."}
                        </span>
                      </div>
                    </>) : null}
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"12px 0 0","fontWeight":"400","fontSize":"18px"}}>
                      {"Saúde das conexões"}
                    </h2>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.cp?.ativo ? (<>
                  {"\n              "}
                  <section aria-label="Canais de aquisição" style={{"display":"flex","flexDirection":"column","gap":"14px"}}>
                    {"\n                "}
                    <div className={"cp-dono"}>
                      {"\n                  "}
                      <span className={"ag4-tile"} style={{"width":"40px","height":"40px","fontSize":"13px","borderRadius":"10px"}}>
                        {"MK"}
                      </span>
                      {"\n                  "}
                      <span style={{"display":"flex","flexDirection":"column","gap":"2px","minWidth":"0","flex":"1 1 260px"}}>
                        <span style={{"fontSize":"15px","fontWeight":"500"}}>
                          {"Agente de Marketing cuida de todos os canais"}
                        </span>
                        <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {__t($v.cp?.donoTexto)}
                        </span>
                      </span>
                      {"\n                  "}
                      <span className={"cp-logos"} aria-label="Conectores do agente">
                        {__arr($v.cp?.conAgente).map((c, $index) => (<React.Fragment key={$index}>
                          <span className={"cp-logo"} data-estado={c?.estado} title={c?.titulo}>
                            <img src={c?.logo} alt={c?.nome} />
                          </span>
                        </React.Fragment>))}
                      </span>
                      {"\n                  "}
                      <button className={"b-pri mini-btn cp-falar"} onClick={$v.cp?.falarGeral}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6.5a2.5 2.5 0 0 1-2.5 2.5H9z"></path>
                        </svg>
                        {"Conversar com o agente"}
                      </button>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cp-grid"}>
                      {"\n                  "}
                      {__arr($v.cp?.canais).map((k, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <article className={"cp-card"} data-sel={k?.sel}>
                          {"\n                      "}
                          <div style={{"display":"flex","alignItems":"flex-start","gap":"10px"}}>
                            {"\n                        "}
                            <div style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"3px"}}>
                              <h3 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"19px"}}>
                                {__t(k?.nome)}
                              </h3>
                              <span style={{"fontSize":"13px","color":"var(--graphite)","lineHeight":"1.45"}}>
                                {__t(k?.desc)}
                              </span>
                            </div>
                            {"\n                        "}
                            <span className={"pk-tag"}>
                              {__t(k?.ativas)}
                            </span>
                            {"\n                      "}
                          </div>
                          {"\n                      "}
                          <dl className={"cp-num"}>
                            <div>
                              <dt>
                                {"Investido"}
                              </dt>
                              <dd>
                                {__t(k?.investido)}
                              </dd>
                            </div>
                            <div>
                              <dt>
                                {"Leads"}
                              </dt>
                              <dd>
                                {__t(k?.leads)}
                              </dd>
                            </div>
                            <div>
                              <dt>
                                {"CPL"}
                              </dt>
                              <dd>
                                {__t(k?.cpl)}
                              </dd>
                            </div>
                          </dl>
                          {"\n                      "}
                          <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                            {"\n                        "}
                            <span className={"cad-label"}>
                              {"O que o agente faz"}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","lineHeight":"1.5"}}>
                              {__t(k?.faz)}
                            </span>
                            {"\n                      "}
                          </div>
                          {"\n                      "}
                          <div className={"cp-cons"}>
                            {"\n                        "}
                            {__arr(k?.cons).map((c, $index) => (<React.Fragment key={$index}>
                              {"\n                          "}
                              <div className={"cp-con"}>
                                <span className={"con-logo"} style={{"width":"30px","height":"30px","borderRadius":"8px"}}>
                                  <img src={c?.logo} alt="" style={{"width":"18px","height":"18px"}} />
                                </span>
                                <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column"}}>
                                  <span style={{"fontSize":"13px","fontWeight":"500"}}>
                                    {__t(c?.nome)}
                                  </span>
                                  <span style={__css(`font-size: 12px; color: ${__s(c?.cor)};`)}>
                                    {__t(c?.status)}
                                  </span>
                                </span>
                                <button className={c?.btnCls} style={{"height":"30px","fontSize":"12px"}} onClick={c?.acao}>
                                  {__t(c?.acaoLabel)}
                                </button>
                              </div>
                              {"\n                        "}
                            </React.Fragment>))}
                            {"\n                      "}
                          </div>
                          {"\n                      "}
                          <div style={{"display":"flex","gap":"8px","flexWrap":"wrap","marginTop":"auto"}}>
                            {"\n                        "}
                            <button className={"b-pri mini-btn cp-falar"} onClick={k?.falar}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6.5a2.5 2.5 0 0 1-2.5 2.5H9z"></path>
                              </svg>
                              {"Falar com o agente"}
                            </button>
                            {"\n                        "}
                            <button className={"b-sec mini-btn"} onClick={k?.filtrar} aria-pressed={k?.sel}>
                              {__t(k?.filtrarLabel)}
                            </button>
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </article>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <p style={{"margin":"0","fontSize":"12px","color":"var(--graphite)"}}>
                      {"Lógica: toda campanha pertence a um canal. O Agente de Marketing planeja e lê os números pelos conectores do canal, o Agente de Copy escreve os anúncios e posts, e o Agente de RevOps liga o lead ao negócio no Pipeline. Mudança de orçamento sempre passa por Aprovações."}
                    </p>
                    {"\n                "}
                    <h2 style={{"fontFamily":"var(--f-display)","margin":"4px 0 0","fontWeight":"400","fontSize":"18px"}}>
                      {"Campanhas"}
                    </h2>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.ix?.ativo ? (<>
                  {"\n              "}
                  <section aria-label="Contas conectadas" style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                    {"\n                "}
                    <div className={"ix-grid"}>
                      {"\n                  "}
                      {__arr($v.ix?.canais).map((c, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"ix-card"} data-on={c?.on}>
                          {"\n                      "}
                          <span className={"con-logo"}>
                            <img src={c?.logo} alt="" />
                          </span>
                          {"\n                      "}
                          <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(c?.nome)}
                            </span>
                            <span style={{"fontSize":"12px","color":"var(--graphite)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {__t(c?.conta)}
                            </span>
                          </span>
                          {"\n                      "}
                          <button className={c?.btnCls} onClick={c?.acao}>
                            {__t(c?.acaoLabel)}
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"ix-regra"}>
                      {"\n                  "}
                      <span className={"ix-regra-ic"}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                        </svg>
                      </span>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"6px","minWidth":"0"}}>
                        {"\n                    "}
                        <span style={{"fontSize":"14px","fontWeight":"600"}}>
                          {"Só entra quem está no CRM"}
                        </span>
                        {"\n                    "}
                        <ul>
                          {"\n                      "}
                          <li>
                            {"A Althius só lê conversas com pessoas cadastradas como contato de uma conta. O resto do seu WhatsApp, LinkedIn, Instagram e e-mail não é lido nem guardado."}
                          </li>
                          {"\n                      "}
                          <li>
                            {"Grupos ficam de fora, mesmo que um contato do CRM participe."}
                          </li>
                          {"\n                      "}
                          <li>
                            {"Excluiu o contato do CRM? As mensagens dele param de entrar na hora, e o que já tinha entrado sai junto."}
                          </li>
                          {"\n                    "}
                        </ul>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.cr?.ativo ? (<>
                  {"\n              "}
                  <section className={"cr-wrap"} aria-label="Créditos">
                    {"\n                "}
                    <div className={"cr-topo"}>
                      {"\n                  "}
                      <div className={"cfg-box cr-saldo"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          <span>
                            {"Saldo do workspace"}
                          </span>
                          <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                            {"Franquia mensal + recargas"}
                          </span>
                        </div>
                        {"\n                    "}
                        <div style={{"padding":"18px 18px 16px","display":"flex","flexDirection":"column","gap":"12px"}}>
                          {"\n                      "}
                          <div style={{"display":"flex","alignItems":"baseline","gap":"10px","flexWrap":"wrap"}}>
                            <span className={"cr-num"}>
                              {__t($v.cr?.saldo)}
                            </span>
                            <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                              {"créditos"}
                            </span>
                          </div>
                          {"\n                      "}
                          <span className={"cr-barra"} role="img" aria-label={$v.cr?.barraRotulo}>
                            <span style={__css(`width: ${__s($v.cr?.pctSaldo)};`)}></span>
                          </span>
                          {"\n                      "}
                          <div style={{"display":"flex","justifyContent":"space-between","gap":"10px","flexWrap":"wrap","fontSize":"13px","color":"var(--graphite)"}}>
                            <span>
                              {__t($v.cr?.entrouTexto)}
                            </span>
                            <span>
                              {__t($v.cr?.duracao)}
                            </span>
                          </div>
                          {"\n                      "}
                          <span style={{"fontSize":"13px","lineHeight":"1.5","color":"var(--text-2)"}}>
                            {"Todo workspace começa com 10.000 créditos por mês. Cada ação de agente consome créditos: conversar, trazer dados, enriquecer, enviar e gerar relatórios."}
                          </span>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          <span>
                            {__t($v.cr?.compraTitulo)}
                          </span>
                          <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                            {__t($v.cr?.compraSub)}
                          </span>
                        </div>
                        {"\n                    "}
                        <div className={"cr-pacotes"}>
                          {"\n                      "}
                          {__arr($v.cr?.pacotes).map((p, $index) => (<React.Fragment key={$index}>
                            <button className={"cr-pacote"} onClick={p?.comprar} disabled={p?.bloqueado}>
                              <span className={"cr-pac-n"}>
                                {__t(p?.creditos)}
                              </span>
                              <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                {"créditos"}
                              </span>
                              <span className={"cr-pac-p"}>
                                {__t(p?.preco)}
                              </span>
                            </button>
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        <span style={{"display":"block","padding":"0 16px 14px","fontSize":"12px","color":"var(--graphite)"}}>
                          {__t($v.cr?.compraNota)}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Como os agentes gastam"}
                        </span>
                        <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                          {"vale para os 4 agentes"}
                        </span>
                      </div>
                      {$v.cr?.leitura ? (<>
                        <div className={"cfg-row"} style={{"padding":"10px 16px 0","fontSize":"12px","color":"var(--graphite)","display":"flex","alignItems":"center","gap":"6px"}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                          </svg>
                          {__t($v.cr?.modoNota)}
                        </div>
                      </>) : null}
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"} style={{"alignItems":"flex-start"}}>
                        {"\n                    "}
                        <div className={"seg seg-li"} role="radiogroup" aria-label="Modo de consumo" style={{"flex":"0 0 auto"}}>
                          {__arr($v.cr?.modos).map((o, $index) => (<React.Fragment key={$index}>
                            <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher} disabled={$v.cr?.leitura}>
                              {__t(o?.label)}
                            </button>
                          </React.Fragment>))}
                        </div>
                        {"\n                    "}
                        <span style={{"flex":"1 1 320px","fontSize":"13px","lineHeight":"1.55"}}>
                          {__t($v.cr?.modoTexto)}
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div className={"cfg-row cfg-row-line"}>
                        {"\n                    "}
                        {$v.cr?.aprovacao ? (<>
                          <label className={"cfg-campo"} style={{"flex":"0 1 220px"}}>
                            <span>
                              {"Pedir aprovação acima de"}
                            </span>
                            <span className={"cad-field"} style={{"height":"40px"}}>
                              <input inputMode="numeric" value={__val($v.cr?.teto)} onChange={$v.cr?.mudarTeto} aria-label="Créditos por ação" disabled={$v.cr?.leitura} />
                              <span style={{"color":"var(--graphite)","fontSize":"13px"}}>
                                {"créditos"}
                              </span>
                            </span>
                          </label>
                        </>) : null}
                        {"\n                    "}
                        <label className={"cfg-campo"} style={{"flex":"0 1 220px"}}>
                          <span>
                            {"Limite por mês"}
                          </span>
                          <span className={"cad-field"} style={{"height":"40px"}}>
                            <input inputMode="numeric" value={__val($v.cr?.limite)} onChange={$v.cr?.mudarLimite} aria-label="Limite mensal de créditos" disabled={$v.cr?.leitura} />
                            <span style={{"color":"var(--graphite)","fontSize":"13px"}}>
                              {"créditos"}
                            </span>
                          </span>
                        </label>
                        {"\n                    "}
                        <span style={{"flex":"1 1 auto"}}></span>
                        {"\n                    "}
                        <span style={{"display":"flex","alignItems":"center","gap":"12px","flex":"1 1 300px"}}>
                          <button className={"switch"} role="switch" aria-checked={$v.cr?.recarga} aria-label="Recarga automática" onClick={$v.cr?.alternarRecarga} disabled={$v.cr?.leitura}></button>
                          <span style={{"display":"flex","flexDirection":"column","gap":"2px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {"Recarga automática"}
                            </span>
                            <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                              {"Abaixo de 1.000, compra 10.000 créditos."}
                            </span>
                          </span>
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cr-meio"}>
                      {"\n                  "}
                      <div className={"cfg-box"}>
                        {"\n                    "}
                        <div className={"cfg-box-h"}>
                          <span>
                            {"Extrato"}
                          </span>
                          <div className={"chips"} role="radiogroup" aria-label="Filtrar extrato">
                            {__arr($v.cr?.filtros).map((f, $index) => (<React.Fragment key={$index}>
                              <button className={"chip"} style={{"height":"28px","fontSize":"12px"}} role="radio" aria-checked={f?.ativo} aria-pressed={f?.ativo} onClick={f?.ir}>
                                {__t(f?.label)}
                              </button>
                            </React.Fragment>))}
                          </div>
                        </div>
                        {"\n                    "}
                        <div className={"cr-ext"} role="table" aria-label="Extrato de créditos">
                          {"\n                      "}
                          <div className={"cr-ext-l cr-ext-h"} role="row">
                            <span role="columnheader">
                              {"Data"}
                            </span>
                            <span role="columnheader">
                              {"Movimento"}
                            </span>
                            <span role="columnheader" style={{"textAlign":"right"}}>
                              {"Créditos"}
                            </span>
                            <span role="columnheader" style={{"textAlign":"right"}}>
                              {"Saldo"}
                            </span>
                          </div>
                          {"\n                      "}
                          {__arr($v.cr?.extrato).map((e, $index) => (<React.Fragment key={$index}>
                            {"\n                        "}
                            <div className={"cr-ext-l"} role="row">
                              <span role="cell" style={{"color":"var(--graphite)"}}>
                                {__t(e?.data)}
                              </span>
                              <span role="cell" style={{"display":"flex","flexDirection":"column","minWidth":"0"}}>
                                <span>
                                  {__t(e?.desc)}
                                </span>
                                <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                  {__t(e?.quem)}
                                </span>
                              </span>
                              <span className={"cr-val"} role="cell" data-tipo={e?.tipo}>
                                {__t(e?.valor)}
                              </span>
                              <span role="cell" style={{"textAlign":"right","color":"var(--graphite)","fontVariantNumeric":"tabular-nums"}}>
                                {__t(e?.saldo)}
                              </span>
                            </div>
                            {"\n                      "}
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"16px"}}>
                        {"\n                    "}
                        <div className={"cfg-box"}>
                          {"\n                      "}
                          <div className={"cfg-box-h"}>
                            <span>
                              {"Por agente"}
                            </span>
                            <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                              {"saídas do ciclo"}
                            </span>
                          </div>
                          {"\n                      "}
                          {__arr($v.cr?.porAgente).map((a, $index) => (<React.Fragment key={$index}>
                            <div className={"cfg-row cfg-row-line"} style={{"padding":"10px 16px","gap":"10px"}}>
                              <span className={"ag4-tile"} style={{"width":"26px","height":"26px","fontSize":"10px","borderRadius":"7px"}}>
                                {__t(a?.sigla)}
                              </span>
                              <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"4px"}}>
                                <span style={{"display":"flex","justifyContent":"space-between","gap":"8px","fontSize":"13px"}}>
                                  <span>
                                    {__t(a?.nome)}
                                  </span>
                                  <span style={{"fontVariantNumeric":"tabular-nums"}}>
                                    {__t(a?.creditos)}
                                  </span>
                                </span>
                                <span className={"cr-barra"} style={{"height":"4px"}}>
                                  <span style={__css(`width: ${__s(a?.pct)};`)}></span>
                                </span>
                              </span>
                            </div>
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                    "}
                        <div className={"cfg-box"}>
                          {"\n                      "}
                          <div className={"cfg-box-h"}>
                            <span>
                              {"Quanto custa cada ação"}
                            </span>
                            <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                              {"em créditos"}
                            </span>
                          </div>
                          {"\n                      "}
                          {__arr($v.cr?.custos).map((c, $index) => (<React.Fragment key={$index}>
                            <div className={"cfg-row cfg-row-line"} style={{"padding":"9px 16px","gap":"10px","flexWrap":"nowrap"}}>
                              <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column"}}>
                                <span style={{"fontSize":"13px"}}>
                                  {__t(c?.acao)}
                                </span>
                                <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                                  {__t(c?.quem)}
                                </span>
                              </span>
                              <span style={{"fontSize":"13px","fontWeight":"500","fontVariantNumeric":"tabular-nums","whiteSpace":"nowrap"}}>
                                {__t(c?.cr)}
                              </span>
                              <span style={{"width":"74px","textAlign":"right","fontSize":"12px","color":"var(--graphite)","fontVariantNumeric":"tabular-nums","whiteSpace":"nowrap"}}>
                                {__t(c?.usd)}
                              </span>
                            </div>
                          </React.Fragment>))}
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.rl?.ativo ? (<>
                  {"\n              "}
                  <section className={"rl-grid"} aria-label="Relatório do ciclo">
                    {"\n                "}
                    <div className={"cfg-box rl-largo"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Pipeline por motion "}
                          <span style={{"fontWeight":"400","color":"var(--graphite)"}}>
                            {"· mesmas 6 etapas, nomes de cada motion"}
                          </span>
                        </span>
                        <a className={"rl-fonte"} href={$v.rl?.hrefPipe}>
                          {"Abrir Pipeline"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6"></path>
                          </svg>
                        </a>
                      </div>
                      {"\n                  "}
                      <div className={"rl-tab"} role="table" aria-label="Pipeline por motion">
                        {"\n                    "}
                        <div className={"rl-tl rl-th"} role="row">
                          <span role="columnheader">
                            {"Etapa"}
                          </span>
                          {__arr($v.rl?.motions).map((m, $index) => (<React.Fragment key={$index}>
                            <span role="columnheader" style={{"textAlign":"right"}}>
                              {__t(m)}
                            </span>
                          </React.Fragment>))}
                          <span role="columnheader" style={{"textAlign":"right"}}>
                            {"Total"}
                          </span>
                        </div>
                        {"\n                    "}
                        {__arr($v.rl?.etapas).map((e, $index) => (<React.Fragment key={$index}>
                          <div className={"rl-tl"} role="row" data-total={e?.total}>
                            <span role="cell">
                              {__t(e?.nome)}
                            </span>
                            {__arr(e?.cels).map((c, $index) => (<React.Fragment key={$index}>
                              <span role="cell" style={{"textAlign":"right","display":"flex","flexDirection":"column","alignItems":"flex-end"}}>
                                <span style={{"fontVariantNumeric":"tabular-nums"}}>
                                  {__t(c?.v)}
                                </span>
                                <span style={{"fontSize":"11px","color":"var(--graphite)"}}>
                                  {__t(c?.n)}
                                </span>
                              </span>
                            </React.Fragment>))}
                          </div>
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Do sinal ao negócio"}
                        </span>
                        <a className={"rl-fonte"} href={$v.rl?.hrefSinais}>
                          {"Sinais"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6"></path>
                          </svg>
                        </a>
                      </div>
                      {"\n                  "}
                      <div style={{"padding":"14px 16px","display":"flex","flexDirection":"column","gap":"9px"}}>
                        {"\n                    "}
                        {__arr($v.rl?.funil).map((f, $index) => (<React.Fragment key={$index}>
                          <div style={{"display":"grid","gridTemplateColumns":"minmax(110px, 1fr) minmax(0, 1.3fr) 56px","gap":"10px","alignItems":"center"}}>
                            <span style={{"fontSize":"13px","display":"flex","flexDirection":"column"}}>
                              <span>
                                {__t(f?.label)}
                              </span>
                              <span style={{"fontSize":"11px","color":"var(--graphite)"}}>
                                {__t(f?.fonte)}
                              </span>
                            </span>
                            <span className={"cr-barra"} style={{"height":"14px","borderRadius":"4px"}}>
                              <span style={__css(`width: ${__s(f?.pct)}; border-radius: 4px;`)}></span>
                            </span>
                            <span style={{"fontSize":"13px","textAlign":"right","fontVariantNumeric":"tabular-nums"}}>
                              {__t(f?.n)}
                            </span>
                          </div>
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Cadências"}
                        </span>
                        <a className={"rl-fonte"} href={$v.rl?.hrefCad}>
                          {"Abrir"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6"></path>
                          </svg>
                        </a>
                      </div>
                      {"\n                  "}
                      {__arr($v.rl?.cadencias).map((c, $index) => (<React.Fragment key={$index}>
                        <div className={"cfg-row cfg-row-line"} style={{"padding":"10px 16px","gap":"10px","flexWrap":"nowrap"}}>
                          <span className={"cop-dot"} style={__css(`background: ${__s(c?.cor)}; width: 7px; height: 7px;`)}></span>
                          <span style={{"flex":"1 1 auto","minWidth":"0","fontSize":"13px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                            {__t(c?.nome)}
                          </span>
                          <span style={{"fontSize":"12px","color":"var(--graphite)","whiteSpace":"nowrap"}}>
                            {__t(c?.contatos)}
                          </span>
                          <span style={{"width":"52px","textAlign":"right","fontSize":"13px","fontVariantNumeric":"tabular-nums"}}>
                            {__t(c?.resposta)}
                          </span>
                        </div>
                      </React.Fragment>))}
                      {"\n                  "}
                      <span style={{"display":"block","padding":"10px 16px 12px","fontSize":"12px","color":"var(--graphite)"}}>
                        {__t($v.rl?.cadNota)}
                      </span>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Campanhas por canal"}
                        </span>
                        <a className={"rl-fonte"} href={$v.rl?.hrefCamp}>
                          {"Abrir"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6"></path>
                          </svg>
                        </a>
                      </div>
                      {"\n                  "}
                      {__arr($v.rl?.canais).map((c, $index) => (<React.Fragment key={$index}>
                        <div className={"cfg-row cfg-row-line"} style={{"padding":"10px 16px","gap":"10px","flexWrap":"nowrap"}}>
                          <span style={{"flex":"1 1 auto","fontSize":"13px"}}>
                            {__t(c?.nome)}
                          </span>
                          <span style={{"fontSize":"12px","color":"var(--graphite)","whiteSpace":"nowrap"}}>
                            {__t(c?.inv)}
                          </span>
                          <span style={{"width":"64px","textAlign":"right","fontSize":"13px","fontVariantNumeric":"tabular-nums"}}>
                            {__t(c?.leads)}
                          </span>
                          <span style={{"width":"64px","textAlign":"right","fontSize":"12px","color":"var(--graphite)","whiteSpace":"nowrap"}}>
                            {__t(c?.cpl)}
                          </span>
                        </div>
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"cfg-box"}>
                      {"\n                  "}
                      <div className={"cfg-box-h"}>
                        <span>
                          {"Créditos por agente"}
                        </span>
                        <a className={"rl-fonte"} href={$v.rl?.hrefCred}>
                          {"Extrato"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6"></path>
                          </svg>
                        </a>
                      </div>
                      {"\n                  "}
                      {__arr($v.rl?.creditos).map((a, $index) => (<React.Fragment key={$index}>
                        <div className={"cfg-row cfg-row-line"} style={{"padding":"10px 16px","gap":"10px","flexWrap":"nowrap"}}>
                          <span style={{"flex":"1 1 auto","fontSize":"13px"}}>
                            {__t(a?.nome)}
                          </span>
                          <span style={{"fontSize":"13px","fontVariantNumeric":"tabular-nums"}}>
                            {__t(a?.creditos)}
                          </span>
                          <span style={{"width":"64px","textAlign":"right","fontSize":"12px","color":"var(--graphite)"}}>
                            {__t(a?.usd)}
                          </span>
                        </div>
                      </React.Fragment>))}
                      {"\n                  "}
                      <span style={{"display":"block","padding":"10px 16px 12px","fontSize":"12px","color":"var(--graphite)"}}>
                        {__t($v.rl?.custoReuniao)}
                      </span>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n              "}
                  <h2 style={{"fontFamily":"var(--f-display)","margin":"4px 0 0","fontWeight":"400","fontSize":"18px"}}>
                    {"Relatórios automáticos"}
                  </h2>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                <div style={{"display":"flex","gap":"8px","flexWrap":"wrap","alignItems":"center"}}>
                  {"\n              "}
                  {$v.md?.temUf ? (<>
                    <button className={"chip"} aria-pressed="true" onClick={$v.md?.limparUf} style={{"height":"36px","display":"inline-flex","alignItems":"center","gap":"6px"}}>
                      {"Estado: "}{__t($v.md?.ufNome)}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18"></path>
                      </svg>
                    </button>
                  </>) : null}
                  {"\n              "}
                  {$v.md?.temBusca ? (<>
                    {"\n                "}
                    <label style={{"flex":"1 1 240px","maxWidth":"360px","height":"44px","boxSizing":"border-box","display":"flex","alignItems":"center","gap":"8px","padding":"0 12px","border":"1px solid var(--rule)","borderRadius":"10px"}}>
                      {"\n                  "}
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{"flex":"none"}}>
                        <circle cx="11" cy="11" r="6.5"></circle>
                        <path d="M16 16l4 4"></path>
                      </svg>
                      {"\n                  "}
                      <input value={__val($v.md?.busca)} onChange={$v.md?.mudarBusca} placeholder={`Buscar em ${__s($v.md?.titulo)}`} aria-label="Buscar" style={{"flex":"1 1 auto","minWidth":"0","border":"none","outline":"none","background":"transparent","fontFamily":"inherit","fontWeight":"400","fontSize":"14px","color":"var(--ink)"}} />
                      {"\n                "}
                    </label>
                    {"\n              "}
                  </>) : null}
                  {"\n              "}
                  <div style={{"display":"flex","gap":"6px","flexWrap":"wrap"}}>
                    {"\n                "}
                    {__arr($v.md?.filtros).map((f, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button aria-pressed={f?.ativo} onClick={f?.ir} style={__css(`display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid ${__s(f?.borda)}; background: ${__s(f?.bg)}; color: ${__s(f?.cor)}; font-family: inherit; font-size: 14px; cursor: pointer; white-space: nowrap; border-radius: 10px;`)}>
                        {f?.temFogo ? (<>
                          <span className={"chamas"} role="img" aria-label={f?.label}>
                            {__arr(f?.chamas).map((ch, $index) => (<React.Fragment key={$index}>
                              <svg className={"chama"} viewBox="0 0 24 24" aria-hidden="true">
                                <path fill={ch?.g} d="M12.2 1.8c.9 3.4 4.9 5.4 5.8 9.3 1 4.6-1.9 9.9-6.2 9.9-4 0-6.7-3.2-6.2-7.2.3-2.3 1.6-3.7 2.5-5.3.3 1.6 1.1 2.6 2.2 3.1-.4-3.6 0-7.2 1.9-9.8z"></path>
                                <path fill="url(#fogo-nucleo)" d="M12.1 11.4c.8 1.6 2.7 2.6 2.7 5 0 1.9-1.2 3.2-2.8 3.2-1.5 0-2.7-1.2-2.7-2.9 0-1.4.8-2.2 1.4-3.1.2.7.6 1.2 1 1.4-.1-1.4 0-2.6.4-3.6z"></path>
                              </svg>
                            </React.Fragment>))}
                          </span>
                        </>) : null}
                        {f?.semFogo ? (<>
                          {__t(f?.label)}
                        </>) : null}
                        {" "}
                        <span style={{"opacity":"0.6"}}>
                          {__t(f?.n)}
                        </span>
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n              "}
                  {$v.pp?.ativo ? (<>
                    {"\n                "}
                    <div className={"seg pk-mot"} role="radiogroup" aria-label="Motion de vendas">
                      {__arr($v.pp?.motions).map((m, $index) => (<React.Fragment key={$index}>
                        <button role="radio" aria-checked={m?.ativo} onClick={m?.ir} title={m?.desc}>
                          {__t(m?.label)}
                          <span className={"pk-n"}>
                            {__t(m?.n)}
                          </span>
                        </button>
                      </React.Fragment>))}
                    </div>
                    {"\n                "}
                    <div className={"pk-quadros"} role="tablist" aria-label="Quadros">
                      {"\n                  "}
                      {__arr($v.pp?.quadros).map((q, $index) => (<React.Fragment key={$index}>
                        <button className={"pk-quadro"} role="tab" aria-selected={q?.ativo} onClick={q?.ir}>
                          {__t(q?.nome)}
                          <span className={"pk-n"}>
                            {__t(q?.n)}
                          </span>
                        </button>
                      </React.Fragment>))}
                      {"\n                  "}
                      {$v.pp?.podeNovo ? (<>
                        <button className={"pk-quadro pk-novo"} onClick={$v.pp?.novoQuadro} aria-label="Novo quadro">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14"></path>
                          </svg>
                          {"Quadro"}
                        </button>
                      </>) : null}
                      {"\n                  "}
                      <span className={"pk-lim"}>
                        {__t($v.pp?.limite)}
                      </span>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </>) : null}
                  {"\n              "}
                  <span style={{"flex":"1 1 auto"}}></span>
                  {"\n              "}
                  {$v.md?.temAcao ? (<>
                    {"\n                "}
                    <button className={"b-pri"} onClick={$v.md?.acao} style={{"height":"44px","padding":"0 18px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"14px","fontWeight":"500","cursor":"pointer","whiteSpace":"nowrap","borderRadius":"10px"}}>
                      {__t($v.md?.acaoLabel)}
                    </button>
                    {"\n              "}
                  </>) : null}
                  {"\n            "}
                </div>
                {"\n            "}
                {$v.md?.temPorConta ? (<>
                  {"\n              "}
                  <section aria-label="Cadência por conta" style={{"display":"flex","flexDirection":"column","gap":"10px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"baseline","justifyContent":"space-between","gap":"12px","flexWrap":"wrap"}}>
                      <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>
                        {"Cadência por conta"}
                      </h2>
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {"Cada pessoa do comitê tem o próprio fluxo"}
                      </span>
                    </div>
                    {"\n                "}
                    <div className={"pc-grid"}>
                      {"\n                  "}
                      {__arr($v.md?.porConta).map((pc, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <button className={"pc-card"} onClick={pc?.abrir}>
                          {"\n                      "}
                          <span style={{"display":"flex","alignItems":"center","justifyContent":"space-between","gap":"8px"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500","textAlign":"left"}}>
                              {__t(pc?.nome)}
                            </span>
                            <span className={"chamas"} role="img" aria-label={pc?.chamasRotulo}>
                              {__arr(pc?.chamas).map((ch, $index) => (<React.Fragment key={$index}>
                                <svg className={"chama"} viewBox="0 0 24 24" aria-hidden="true">
                                  <path fill={ch?.g} d="M12.2 1.8c.9 3.4 4.9 5.4 5.8 9.3 1 4.6-1.9 9.9-6.2 9.9-4 0-6.7-3.2-6.2-7.2.3-2.3 1.6-3.7 2.5-5.3.3 1.6 1.1 2.6 2.2 3.1-.4-3.6 0-7.2 1.9-9.8z"></path>
                                  <path fill="url(#fogo-nucleo)" d="M12.1 11.4c.8 1.6 2.7 2.6 2.7 5 0 1.9-1.2 3.2-2.8 3.2-1.5 0-2.7-1.2-2.7-2.9 0-1.4.8-2.2 1.4-3.1.2.7.6 1.2 1 1.4-.1-1.4 0-2.6.4-3.6z"></path>
                                </svg>
                              </React.Fragment>))}
                            </span>
                          </span>
                          {"\n                      "}
                          <span style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                            {"\n                        "}
                            <span className={"pilha"}>
                              {__arr(pc?.fotos).map((ft, $index) => (<React.Fragment key={$index}>
                                <img className={"foto foto-sm"} src={ft?.src} alt={ft?.nome} />
                              </React.Fragment>))}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"12px","color":"var(--graphite)","textAlign":"left"}}>
                              {__t(pc?.resumo)}
                            </span>
                            {"\n                      "}
                          </span>
                          {"\n                      "}
                          <span className={"pc-prox"}>
                            {pc?.c_email ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect>
                                <path d="M4 7l8 6 8-6"></path>
                              </svg>
                            </>) : null}
                            {pc?.c_linkedin ? (<>
                              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                              </svg>
                            </>) : null}
                            {pc?.c_whatsapp ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"></path>
                                <path d="M9.2 8.6c.2 2.6 3.2 5.7 5.9 6 .6 0 1.3-.7 1.4-1.3l-1.8-.9-.9.9c-1-.4-2.4-1.8-2.8-2.8l.9-.9-.9-1.8c-.6.1-1.4.8-1.8 1.4z"></path>
                              </svg>
                            </>) : null}
                            {pc?.c_ligacao ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A15.1 15.1 0 0 1 3.4 6.1 1.6 1.6 0 0 1 5 4.5z"></path>
                              </svg>
                            </>) : null}
                            {pc?.c_instagram ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                                <circle cx="12" cy="12" r="4"></circle>
                                <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"></circle>
                              </svg>
                            </>) : null}
                            <span>
                              {__t(pc?.proximo)}
                            </span>
                          </span>
                          {"\n                    "}
                        </button>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.pp?.ativo ? (<>
                  {"\n              "}
                  <section aria-label={`Quadro ${__s($v.pp?.quadroNome)}`} style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                    {"\n                "}
                    <div className={"pk-topo"}>
                      {"\n                  "}
                      {$v.pp?.renomeando ? (<>
                        {"\n                    "}
                        <span className={"cad-field"} style={{"height":"38px","width":"min(360px, 100%)"}}>
                          <input value={__val($v.pp?.nomeRascunho)} onChange={$v.pp?.mudarNome} onKeyDown={$v.pp?.teclaNome} aria-label="Nome do quadro" maxLength="40" />
                        </span>
                        {"\n                    "}
                        <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={$v.pp?.salvarNome}>
                          {"Salvar"}
                        </button>
                        {"\n                    "}
                        {$v.pp?.podeExcluir ? (<>
                          <button className={"b-sec mini-btn"} style={{"color":"var(--err)"}} onClick={$v.pp?.excluir}>
                            {"Excluir quadro"}
                          </button>
                        </>) : null}
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      {$v.pp?.naoRenomeando ? (<>
                        {"\n                    "}
                        <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"22px"}}>
                          {__t($v.pp?.quadroNome)}
                        </h2>
                        {"\n                    "}
                        <button className={"icon-btn"} onClick={$v.pp?.renomear} aria-label="Renomear quadro" title="Renomear quadro" disabled={$v.pp?.naoGere}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14.5 5.5l4 4"></path>
                            <path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"></path>
                          </svg>
                        </button>
                        {"\n                  "}
                      </>) : null}
                      {"\n                  "}
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t($v.pp?.motionDesc)}
                      </span>
                      {"\n                  "}
                      <span style={{"flex":"1 1 auto"}}></span>
                      {"\n                  "}
                      <span className={"pk-resumo"}>
                        {__t($v.pp?.resumo)}
                      </span>
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <div className={"pk-board"} role="list">
                      {"\n                  "}
                      {__arr($v.pp?.colunas).map((col, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"pk-col"} role="listitem" aria-label={col?.titulo} data-alvo={col?.alvo} data-arrastando={col?.arrastando} onDragOver={col?.over} onDrop={col?.drop} onDragLeave={col?.leave}>
                          {"\n                      "}
                          <div className={"pk-col-h"}>
                            {"\n                        "}
                            {col?.movivel ? (<>
                              <span className={"pk-grip"} draggable="true" onDragStart={col?.dragStart} onDragEnd={col?.dragEnd} title="Arraste para reordenar a etapa" aria-label={`Reordenar etapa ${__s(col?.titulo)}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="9" cy="6" r="1"></circle>
                                  <circle cx="15" cy="6" r="1"></circle>
                                  <circle cx="9" cy="12" r="1"></circle>
                                  <circle cx="15" cy="12" r="1"></circle>
                                  <circle cx="9" cy="18" r="1"></circle>
                                  <circle cx="15" cy="18" r="1"></circle>
                                </svg>
                              </span>
                            </>) : null}
                            {"\n                        "}
                            {col?.fixa ? (<>
                              <span className={"pk-grip pk-grip-off"} title="Ganho fica sempre no fim">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="9" cy="6" r="1"></circle>
                                  <circle cx="15" cy="6" r="1"></circle>
                                  <circle cx="9" cy="12" r="1"></circle>
                                  <circle cx="15" cy="12" r="1"></circle>
                                  <circle cx="9" cy="18" r="1"></circle>
                                  <circle cx="15" cy="18" r="1"></circle>
                                </svg>
                              </span>
                            </>) : null}
                            {"\n                        "}
                            <span className={"pk-col-t"}>
                              {__t(col?.titulo)}
                            </span>
                            <span className={"pk-cont"}>
                              {__t(col?.n)}
                            </span>
                            {"\n                        "}
                            <span style={{"flex":"1 1 auto"}}></span>
                            {"\n                        "}
                            <span className={"pk-total"}>
                              {__t(col?.total)}
                            </span>
                            {"\n                        "}
                            <button className={"icon-btn pk-add"} onClick={col?.adicionar} aria-label={`Adicionar negócio em ${__s(col?.titulo)}`} title="Adicionar negócio">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 5v14M5 12h14"></path>
                              </svg>
                            </button>
                            {"\n                      "}
                          </div>
                          {"\n                      "}
                          <div className={"pk-cards"}>
                            {"\n                        "}
                            {__arr(col?.itens).map((c, $index) => (<React.Fragment key={$index}>
                              {"\n                          "}
                              <div className={"pk-card"} role="button" tabIndex="0" draggable="true" data-antes={c?.antes} data-arrastando={c?.arrastando} onDragStart={c?.dragStart} onDragEnd={c?.dragEnd} onDragOver={c?.over} onDrop={c?.drop} onClick={c?.abrir} onKeyDown={c?.tecla} aria-label={c?.rotulo}>
                                {"\n                            "}
                                <span className={"pk-l1"}>
                                  <span className={"co-logo"} style={{"width":"24px","height":"24px","borderRadius":"7px"}} aria-hidden="true">
                                    <span className={"co-sigla"}>
                                      {__t(c?.coSigla)}
                                    </span>
                                    {c?.coTem ? (<>
                                      <img src={c?.coLogo} onError={c?.coErro} onLoad={c?.coLoad} alt="" />
                                    </>) : null}
                                  </span>
                                  <span className={"pk-conta"} style={{"flex":"1 1 auto"}}>
                                    {__t(c?.conta)}
                                  </span>
                                  <span className={"pk-tag"}>
                                    {__t(c?.motion)}
                                  </span>
                                </span>
                                {"\n                            "}
                                <span className={"pk-dono"}>
                                  <span className={"membro-av"} style={{"width":"20px","height":"20px","fontSize":"9px"}}>
                                    {__t(c?.sigla)}
                                    {c?.temFoto ? (<>
                                      <img className={"foto"} src={c?.foto} alt="" />
                                    </>) : null}
                                  </span>
                                  {__t(c?.dono)}
                                </span>
                                {"\n                            "}
                                <span className={"pk-prob"}>
                                  <span style={{"display":"flex","justifyContent":"space-between","fontSize":"12px","color":"var(--graphite)"}}>
                                    <span>
                                      {"Chance de ganho"}
                                    </span>
                                    <span style={{"color":"var(--ink)","fontVariantNumeric":"tabular-nums"}}>
                                      {__t(c?.prob)}
                                    </span>
                                  </span>
                                  <span className={"pk-barra"}>
                                    <span style={__css(`width: ${__s(c?.prob)}; background: ${__s(c?.cor)};`)}></span>
                                  </span>
                                </span>
                                {"\n                            "}
                                <span className={"pk-meta"}>
                                  <span>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"></path>
                                      <circle cx="12" cy="10" r="2.3"></circle>
                                    </svg>
                                    {__t(c?.cidade)}
                                  </span>
                                  <span>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5"></rect>
                                      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"></path>
                                    </svg>
                                    {__t(c?.fecha)}
                                  </span>
                                </span>
                                {"\n                            "}
                                <span className={"pk-rodape"}>
                                  <span className={"pk-valor"}>
                                    {__t(c?.valor)}
                                  </span>
                                  <span className={"pk-status"} style={__css(`color: ${__s(c?.cor)};`)}>
                                    <span style={__css(`width: 6px; height: 6px; border-radius: 50%; background: ${__s(c?.cor)};`)}></span>
                                    {__t(c?.status)}
                                  </span>
                                </span>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </React.Fragment>))}
                            {"\n                        "}
                            {col?.vazia ? (<>
                              <div className={"pk-vazio"}>
                                {"Solte um negócio aqui"}
                              </div>
                            </>) : null}
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n                "}
                    <p style={{"margin":"0","fontSize":"12px","color":"var(--graphite)"}}>
                      {__t($v.pp?.nota)}
                    </p>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.md?.vazio ? (<>
                  {"\n              "}
                  <div style={{"padding":"28px 24px","background":"var(--mist)","display":"flex","flexDirection":"column","gap":"8px","alignItems":"flex-start"}}>
                    <span style={{"fontSize":"18px"}}>
                      {"Nada por aqui"}
                    </span>
                    <span style={{"fontSize":"14px","color":"var(--graphite)"}}>
                      {"Nenhum item corresponde à busca ou ao filtro."}
                    </span>
                    <button className={"b-sec"} onClick={$v.md?.limpar} style={{"height":"40px","padding":"0 14px","border":"1px solid var(--ink)","background":"var(--paper)","fontFamily":"inherit","fontSize":"14px","cursor":"pointer","borderRadius":"10px"}}>
                      {"Limpar filtros"}
                    </button>
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.md?.tabela ? (<>
                  {"\n              "}
                  <div role="table" aria-label={$v.md?.titulo} style={{"borderTop":"1px solid var(--ink)"}}>
                    {"\n                "}
                    {$v.lay?.notMobile ? (<>
                      {"\n                  "}
                      <div role="row" style={__css(`display: grid; grid-template-columns: ${__s($v.md?.cols)}; gap: 16px; padding: 10px 12px; border-bottom: 1px solid var(--rule);`)}>
                        {"\n                    "}
                        {__arr($v.md?.cabecalho).map((c, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <button className={"b-ghost"} role="columnheader" onClick={c?.ordenar} style={{"padding":"0","border":"none","background":"transparent","fontFamily":"inherit","fontSize":"13px","color":"var(--graphite)","cursor":"pointer","textAlign":"left","display":"flex","gap":"4px","alignItems":"center"}}>
                            {__t(c?.label)}
                            <span style={{"color":"var(--ink)"}}>
                              {__t(c?.seta)}
                            </span>
                          </button>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    {__arr($v.md?.linhas).map((l, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div className="v18-hover-0" role="row" onClick={l?.abrir} tabIndex="0" onKeyDown={l?.tecla} style={__css(`display: grid; grid-template-columns: ${__s($v.md?.colsLinha)}; gap: 4px 16px; padding: 14px 12px; border-bottom: 1px solid var(--rule); cursor: pointer; background: ${__s(l?.bg)};`)}>
                        {"\n                    "}
                        {__arr(l?.celulas).map((c, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <span role="cell" style={__css(`min-width: 0; display: flex; align-items: center; gap: 8px; font-size: ${__s(c?.fs)}; color: ${__s(c?.cor)}; font-variant-numeric: tabular-nums;`)}>
                            {"\n                        "}
                            {c?.temPonto ? (<>
                              <span style={__css(`flex: none; width: 8px; height: 8px; border-radius: 50%; background: ${__s(c?.ponto)};`)}></span>
                            </>) : null}
                            {"\n                        "}
                            {c?.temCo ? (<>
                              <span className={"co-logo"} style={{"width":"28px","height":"28px"}} aria-hidden="true">
                                <span className={"co-sigla"}>
                                  {__t(c?.coSigla)}
                                </span>
                                {c?.coTem ? (<>
                                  <img src={c?.coLogo} onError={c?.coErro} onLoad={c?.coLoad} alt="" />
                                </>) : null}
                              </span>
                            </>) : null}
                            {c?.temFoto ? (<>
                              <img className={"foto foto-sm"} src={c?.foto} alt="" />
                            </>) : null}
                            {"\n                        "}
                            {c?.temFogo ? (<>
                              <span className={"chamas"} role="img" aria-label={c?.fogoRotulo}>
                                {__arr(c?.chamas).map((ch, $index) => (<React.Fragment key={$index}>
                                  <svg className={"chama"} viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill={ch?.g} d="M12.2 1.8c.9 3.4 4.9 5.4 5.8 9.3 1 4.6-1.9 9.9-6.2 9.9-4 0-6.7-3.2-6.2-7.2.3-2.3 1.6-3.7 2.5-5.3.3 1.6 1.1 2.6 2.2 3.1-.4-3.6 0-7.2 1.9-9.8z"></path>
                                    <path fill="url(#fogo-nucleo)" d="M12.1 11.4c.8 1.6 2.7 2.6 2.7 5 0 1.9-1.2 3.2-2.8 3.2-1.5 0-2.7-1.2-2.7-2.9 0-1.4.8-2.2 1.4-3.1.2.7.6 1.2 1 1.4-.1-1.4 0-2.6.4-3.6z"></path>
                                  </svg>
                                </React.Fragment>))}
                              </span>
                            </>) : null}
                            {"\n                        "}
                            {c?.temTexto ? (<>
                              <span style={__css(`min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: ${__s(c?.ws)};`)}>
                                {__t(c?.v)}
                              </span>
                            </>) : null}
                            {"\n                      "}
                          </span>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.md?.kanban ? (<>
                  {"\n              "}
                  <div style={{"display":"grid","gridAutoFlow":"column","gridAutoColumns":"minmax(240px, 1fr)","gap":"12px","overflowX":"auto","paddingBottom":"8px"}}>
                    {"\n                "}
                    {__arr($v.md?.colunasK).map((col, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"background":"var(--mist)","padding":"10px","display":"flex","flexDirection":"column","gap":"8px","minHeight":"240px"}}>
                        {"\n                    "}
                        <span style={{"display":"flex","justifyContent":"space-between","padding":"4px 4px 6px","fontSize":"14px"}}>
                          <span>
                            {__t(col?.titulo)}
                          </span>
                          <span style={{"color":"var(--graphite)"}}>
                            {__t(col?.total)}
                          </span>
                        </span>
                        {"\n                    "}
                        {__arr(col?.itens).map((l, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <div className="v18-hover-1" role="button" tabIndex="0" onClick={l?.abrir} onKeyDown={l?.tecla} style={{"background":"var(--paper)","border":"1px solid var(--rule)","padding":"12px","display":"flex","flexDirection":"column","gap":"4px","cursor":"pointer","borderRadius":"14px","overflow":"hidden"}}>
                            {"\n                        "}
                            <span style={{"fontSize":"14px"}}>
                              {__t(l?.titulo)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"14px","fontVariantNumeric":"tabular-nums"}}>
                              {__t(l?.valor)}
                            </span>
                            {"\n                        "}
                            <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                              {__t(l?.dono)}
                            </span>
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </div>
              {"\n          "}
              {$v.md?.detalheAberto ? (<>
                {"\n            "}
                <div onClick={$v.md?.fechar} style={{"position":"fixed","inset":"0","zIndex":"75","background":"var(--veil)"}}></div>
                {"\n            "}
                <aside role="dialog" aria-label={$v.md?.det?.titulo} style={__css(`position: fixed; top: 0; right: 0; bottom: 0; z-index: 76; width: ${__s($v.lay?.copW)}; background: var(--paper); border-left: 1px solid var(--rule); display: flex; flex-direction: column;`)}>
                  {"\n              "}
                  <div style={{"flex":"0 0 auto","padding":"16px 18px","borderBottom":"1px solid var(--rule)","display":"flex","alignItems":"flex-start","gap":"10px"}}>
                    {"\n                "}
                    <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"4px"}}>
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {__t($v.md?.titulo)}
                      </span>
                      <span style={{"fontFamily":"var(--f-display)","fontSize":"22px","lineHeight":"1.2"}}>
                        {__t($v.md?.det?.titulo)}
                      </span>
                    </span>
                    {"\n                "}
                    <button className={"b-sec"} onClick={$v.md?.fechar} aria-label="Fechar" style={{"flex":"none","width":"44px","height":"44px","border":"1px solid var(--rule)","background":"var(--paper)","fontFamily":"inherit","display":"grid","placeItems":"center","color":"var(--ink)","cursor":"pointer","borderRadius":"10px"}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18"></path>
                      </svg>
                    </button>
                    {"\n              "}
                  </div>
                  {"\n              "}
                  <dl style={{"flex":"1 1 auto","overflowY":"auto","margin":"0","padding":"8px 18px 18px"}}>
                    {"\n                "}
                    {__arr($v.md?.det?.campos).map((c, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div style={{"padding":"12px 0","borderBottom":"1px solid var(--mist)","display":"flex","flexDirection":"column","gap":"2px"}}>
                        <dt style={{"fontSize":"13px","color":"var(--graphite)"}}>
                          {__t(c?.label)}
                        </dt>
                        <dd style={{"margin":"0","fontSize":"15px","textWrap":"pretty"}}>
                          {__t(c?.v)}
                        </dd>
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </dl>
                  {"\n              "}
                  {$v.md?.det?.temAcoes ? (<>
                    {"\n                "}
                    <div style={{"flex":"0 0 auto","padding":"14px 18px","borderTop":"1px solid var(--rule)","display":"flex","gap":"8px","flexWrap":"wrap"}}>
                      {"\n                  "}
                      {__arr($v.md?.det?.acoes).map((b, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <button onClick={b?.fn} style={__css(`min-height: 44px; padding: 0 16px; border: 1px solid ${__s(b?.borda)}; background: ${__s(b?.bg)}; color: ${__s(b?.cor)}; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 10px;`)}>
                          {__t(b?.label)}
                        </button>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </>) : null}
                  {"\n            "}
                </aside>
                {"\n          "}
              </>) : null}
              {"\n        "}
            </>) : null}
            {"\n\n      "}
          </main>
          {"\n    "}
        </div>
        {"\n\n\n    "}
        {$v.cta?.aberta ? (<>
          {"\n      "}
          <div onClick={$v.cta?.fechar} style={{"position":"fixed","inset":"0","zIndex":"77","background":"var(--veil)"}}></div>
          {"\n      "}
          <aside className={"conta-drawer"} role="dialog" aria-label={$v.cta?.nome} style={__css(`width: ${__s($v.cta?.w)};`)}>
            {"\n        "}
            <div style={{"flex":"0 0 auto","padding":"18px 20px 0","display":"flex","flexDirection":"column","gap":"14px","borderBottom":"1px solid var(--rule)"}}>
              {"\n          "}
              <div style={{"display":"flex","alignItems":"flex-start","gap":"14px"}}>
                {"\n            "}
                <span className={"co-logo"} style={{"width":"56px","height":"56px","borderRadius":"14px"}} aria-hidden="true">
                  <span className={"co-sigla"}>
                    {__t($v.cta?.coSigla)}
                  </span>
                  {$v.cta?.coTem ? (<>
                    <img src={$v.cta?.coLogo} onError={$v.cta?.coErro} onLoad={$v.cta?.coLoad} alt="" />
                  </>) : null}
                </span>
                {"\n            "}
                <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"6px"}}>
                  {"\n              "}
                  <span style={{"fontFamily":"var(--f-display)","fontSize":"26px","lineHeight":"1.1"}}>
                    {__t($v.cta?.nome)}
                  </span>
                  {"\n              "}
                  <span style={{"display":"flex","alignItems":"center","gap":"10px","flexWrap":"wrap","fontSize":"13px","color":"var(--graphite)"}}>
                    <span className={"chamas"} role="img" aria-label={$v.cta?.chamasRotulo}>
                      {__arr($v.cta?.chamas).map((ch, $index) => (<React.Fragment key={$index}>
                        <svg className={"chama"} viewBox="0 0 24 24" aria-hidden="true">
                          <path fill={ch?.g} d="M12.2 1.8c.9 3.4 4.9 5.4 5.8 9.3 1 4.6-1.9 9.9-6.2 9.9-4 0-6.7-3.2-6.2-7.2.3-2.3 1.6-3.7 2.5-5.3.3 1.6 1.1 2.6 2.2 3.1-.4-3.6 0-7.2 1.9-9.8z"></path>
                          <path fill="url(#fogo-nucleo)" d="M12.1 11.4c.8 1.6 2.7 2.6 2.7 5 0 1.9-1.2 3.2-2.8 3.2-1.5 0-2.7-1.2-2.7-2.9 0-1.4.8-2.2 1.4-3.1.2.7.6 1.2 1 1.4-.1-1.4 0-2.6.4-3.6z"></path>
                        </svg>
                      </React.Fragment>))}
                    </span>
                    <span>
                      {"Fit "}{__t($v.cta?.fit)}
                    </span>
                    <span aria-hidden="true">
                      {"·"}
                    </span>
                    <span>
                      {__t($v.cta?.segmento)}
                    </span>
                    <span aria-hidden="true">
                      {"·"}
                    </span>
                    <span>
                      {__t($v.cta?.cidade)}
                    </span>
                  </span>
                  {"\n              "}
                  <span style={{"display":"flex","alignItems":"center","gap":"8px","fontSize":"13px"}}>
                    <img className={"foto foto-xs"} src={$v.cta?.donoFoto} alt="" />
                    <span style={{"color":"var(--graphite)"}}>
                      {"Responsável"}
                    </span>
                    <span style={{"fontWeight":"500"}}>
                      {__t($v.cta?.dono)}
                    </span>
                  </span>
                  {"\n              "}
                  <span className={"co-site"}>
                    {"\n                "}
                    {$v.cta?.siteEditando ? (<>
                      {"\n                  "}
                      <span className={"cad-field"} style={{"flex":"1 1 260px","height":"34px"}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8.5"></circle>
                          <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"></path>
                        </svg>
                        <input value={__val($v.cta?.siteRascunho)} onChange={$v.cta?.siteMudar} onKeyDown={$v.cta?.siteTecla} placeholder="empresa.com.br" aria-label="Site da empresa" />
                      </span>
                      {"\n                  "}
                      <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={$v.cta?.siteSalvar}>
                        {"Puxar logo"}
                      </button>
                      {"\n                  "}
                      <button className={"icon-btn"} onClick={$v.cta?.siteCancelar} aria-label="Cancelar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18"></path>
                        </svg>
                      </button>
                      {"\n                  "}
                      {$v.cta?.siteTemErro ? (<>
                        <span style={{"flexBasis":"100%","fontSize":"12px","color":"var(--err)"}}>
                          {__t($v.cta?.siteErro)}
                        </span>
                      </>) : null}
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    {$v.cta?.siteTem ? (<>
                      {"\n                  "}
                      <a className={"co-link"} href={$v.cta?.siteHref} target="_blank" rel="noopener">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8.5"></circle>
                          <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"></path>
                        </svg>
                        {__t($v.cta?.site)}
                      </a>
                      {"\n                  "}
                      <button className={"icon-btn"} style={{"width":"28px","height":"28px"}} onClick={$v.cta?.siteEditar} aria-label="Editar site da empresa" title="Editar site">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14.5 5.5l4 4"></path>
                          <path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"></path>
                        </svg>
                      </button>
                      {"\n                "}
                    </>) : null}
                    {"\n                "}
                    {$v.cta?.siteVazio ? (<>
                      <button className={"add-link"} onClick={$v.cta?.siteEditar}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14"></path>
                        </svg>
                        {"Adicionar site e puxar o logo"}
                      </button>
                    </>) : null}
                    {"\n              "}
                  </span>
                  {"\n            "}
                </span>
                {"\n            "}
                <button className={"b-sec"} onClick={$v.cta?.fechar} aria-label="Fechar" style={{"flex":"none","width":"40px","height":"40px","border":"1px solid var(--rule)","borderRadius":"10px","background":"var(--paper)","color":"var(--ink)","cursor":"pointer","display":"grid","placeItems":"center"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18"></path>
                  </svg>
                </button>
                {"\n          "}
              </div>
              {"\n          "}
              <div role="tablist" aria-label="Seções da conta" style={{"display":"flex","gap":"4px"}}>
                {"\n            "}
                {__arr($v.cta?.tabs).map((t, $index) => (<React.Fragment key={$index}>
                  {"\n              "}
                  <button className={"ct-tab"} role="tab" aria-selected={t?.ativo} onClick={t?.ir}>
                    {__t(t?.label)}
                    <span className={"ct-tab-n"}>
                      {__t(t?.n)}
                    </span>
                  </button>
                  {"\n            "}
                </React.Fragment>))}
                {"\n          "}
              </div>
              {"\n        "}
            </div>
            {"\n        "}
            <div className={"scroll-area"} style={{"flex":"1 1 auto","overflowY":"auto","padding":"18px 20px 24px","display":"flex","flexDirection":"column","gap":"20px"}}>
              {"\n\n          "}
              {$v.cta?.tabComite ? (<>
                {"\n            "}
                <div className={"sync-bar"}>
                  {"\n              "}
                  <span style={{"color":"#0A66C2","display":"grid","placeItems":"center"}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                    </svg>
                  </span>
                  {"\n              "}
                  <span style={{"flex":"1 1 auto","minWidth":"0","fontSize":"13px"}}>
                    {__t($v.cta?.syncTexto)}
                  </span>
                  {"\n              "}
                  <button className={"b-sec mini-btn"} onClick={$v.cta?.sincronizar} aria-busy={$v.cta?.sincronizando}>
                    {$v.cta?.sincOn ? (<>
                      <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"13px"}}>
                        <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                      </svg>
                    </>) : null}
                    {$v.cta?.sincOff ? (<>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"></path>
                        <path d="M18 3v4h-4M6 21v-4h4"></path>
                      </svg>
                    </>) : null}
                    {__t($v.cta?.syncBotao)}
                  </button>
                  {"\n            "}
                </div>
                {"\n            "}
                {__arr($v.cta?.grupos).map((g, $index) => (<React.Fragment key={$index}>
                  {"\n              "}
                  <section style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"baseline","gap":"8px"}}>
                      <h3 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"17px"}}>
                        {__t(g?.titulo)}
                      </h3>
                      <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                        {__t(g?.desc)}
                      </span>
                    </div>
                    {"\n                "}
                    {__arr(g?.pessoas).map((ps, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <div className={"pessoa"}>
                        {"\n                        "}
                        <img className={"foto foto-md"} src={ps?.foto} alt={`Foto de ${__s(ps?.nome)}`} />
                        {"\n                        "}
                        <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"1px"}}>
                          {"\n                          "}
                          <span style={{"display":"flex","alignItems":"center","gap":"6px","flexWrap":"wrap"}}>
                            <span style={{"fontSize":"14px","fontWeight":"500"}}>
                              {__t(ps?.nome)}
                            </span>
                            <a className={"li-link"} href={ps?.linkedin} target="_blank" rel="noopener" aria-label={`Perfil de ${__s(ps?.nome)} no LinkedIn`} title="Abrir no LinkedIn">
                              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                              </svg>
                            </a>
                          </span>
                          {"\n                          "}
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                            {__t(ps?.cargo)}
                          </span>
                          {"\n                          "}
                          <span style={{"fontSize":"12px","color":"var(--muted)"}}>
                            {__t(ps?.contato)}
                          </span>
                          {"\n                          "}
                          {ps?.liEditando ? (<>
                            {"\n                            "}
                            <span className={"li-edit"}>
                              <span className={"cad-field"} style={{"flex":"1 1 auto","height":"34px"}}>
                                <span style={{"color":"#0A66C2","display":"grid"}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                                  </svg>
                                </span>
                                <input value={__val(ps?.liRascunho)} onChange={ps?.liMudar} onKeyDown={ps?.liTecla} placeholder="https://www.linkedin.com/in/nome-da-pessoa" aria-label={`URL do LinkedIn de ${__s(ps?.nome)}`} />
                              </span>
                              <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={ps?.liSalvar}>
                                {"Salvar"}
                              </button>
                              <button className={"icon-btn"} onClick={ps?.liCancelar} aria-label="Cancelar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M6 6l12 12M18 6L6 18"></path>
                                </svg>
                              </button>
                            </span>
                            {"\n                            "}
                            {ps?.liTemErro ? (<>
                              <span style={{"fontSize":"12px","color":"var(--err)"}}>
                                {__t(ps?.liErro)}
                              </span>
                            </>) : null}
                            {"\n                          "}
                          </>) : null}
                          {"\n                          "}
                          {ps?.liNaoEditando ? (<>
                            {"\n                            "}
                            <span className={"li-linha"}>
                              {"\n                              "}
                              <span className={"seg seg-li li-status"} role="radiogroup" aria-label="Status no LinkedIn">
                                {__arr(ps?.liStatus).map((o, $index) => (<React.Fragment key={$index}>
                                  <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                    {__t(o?.label)}
                                  </button>
                                </React.Fragment>))}
                              </span>
                              {"\n                              "}
                              <a className={"cad-acao li-acao"} href={ps?.liHref} target="_blank" rel="noopener" onClick={ps?.liAcao}>
                                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                                  <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                                </svg>
                                {__t(ps?.liAcaoLabel)}
                              </a>
                              {"\n                              "}
                              <button className={"icon-btn"} onClick={ps?.liEditar} aria-label="Editar URL do LinkedIn" title={ps?.liUrlTexto}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M14.5 5.5l4 4"></path>
                                  <path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"></path>
                                </svg>
                              </button>
                              {"\n                            "}
                            </span>
                            {"\n                          "}
                          </>) : null}
                          {"\n                        "}
                        </span>
                        {"\n                        "}
                        <button className={"b-sec mini-btn"} onClick={ps?.verCadencia} style={{"alignSelf":"flex-start"}}>
                          {"Cadência"}
                        </button>
                        {"\n                      "}
                      </div>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n                "}
                    {g?.vazio ? (<>
                      {"\n                  "}
                      <div className={"pessoa pessoa-vazia"}>
                        <span style={{"flex":"1 1 auto","fontSize":"13px","color":"var(--graphite)"}}>
                          {__t(g?.vazioTexto)}
                        </span>
                        <button className={"b-sec mini-btn"} onClick={$v.cta?.mapear}>
                          {"Mapear com Agente Comercial"}
                        </button>
                      </div>
                      {"\n                "}
                    </>) : null}
                    {"\n              "}
                  </section>
                  {"\n            "}
                </React.Fragment>))}
                {"\n          "}
              </>) : null}
              {"\n\n          "}
              {$v.cta?.tabCadencia ? (<>
                {"\n            "}
                {$v.cta?.semPessoas ? (<>
                  {"\n              "}
                  <div className={"pessoa pessoa-vazia"} style={{"flexDirection":"column","alignItems":"flex-start","gap":"10px"}}>
                    <span style={{"fontSize":"14px"}}>
                      {"Ninguém do comitê foi mapeado ainda."}
                    </span>
                    <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                      {"A cadência é criada por pessoa. Mapeie o comitê primeiro."}
                    </span>
                    <button className={"b-pri mini-btn"} style={{"background":"var(--ink)","color":"var(--paper)","borderColor":"var(--ink)"}} onClick={$v.cta?.mapear}>
                      {"Mapear com Agente Comercial"}
                    </button>
                  </div>
                  {"\n            "}
                </>) : null}
                {"\n            "}
                {$v.cta?.temPessoas ? (<>
                  {"\n              "}
                  <div role="radiogroup" aria-label="Pessoa da cadência" style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                    {"\n                "}
                    {__arr($v.cta?.personas).map((pp, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <button className={"persona-chip"} role="radio" aria-checked={pp?.ativo} onClick={pp?.escolher}>
                        <img className={"foto foto-xs"} src={pp?.foto} alt="" />
                        <span style={{"display":"flex","flexDirection":"column","alignItems":"flex-start","lineHeight":"1.2"}}>
                          <span style={{"fontSize":"13px","fontWeight":"500"}}>
                            {__t(pp?.nome)}
                          </span>
                          <span style={{"fontSize":"11px","color":"var(--graphite)"}}>
                            {__t(pp?.papel)}
                          </span>
                        </span>
                      </button>
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n              "}
                  </div>
                  {"\n\n              "}
                  <section className={"cad-box"}>
                    {"\n                "}
                    <div className={"cad-box-h"}>
                      <span>
                        {"Contatos de "}{__t($v.cad?.primeiro)}
                      </span>
                      <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                        {"até 3 de cada"}
                      </span>
                    </div>
                    {"\n                "}
                    <div className={"cad-contatos"}>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                        {"\n                    "}
                        <span className={"cad-label"}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect>
                            <path d="M4 7l8 6 8-6"></path>
                          </svg>
                          {"E-mails"}
                        </span>
                        {"\n                    "}
                        {__arr($v.cad?.emails).map((em, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <span className={"cad-field"}>
                            <input type="email" value={__val(em?.v)} onChange={em?.mudar} aria-label={`E-mail ${__s(em?.n)}`} placeholder="nome@empresa.com.br" />
                            <button className={"icon-btn"} onClick={em?.remover} aria-label={`Remover e-mail ${__s(em?.n)}`} title="Remover">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18"></path>
                              </svg>
                            </button>
                          </span>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                    "}
                        {$v.cad?.podeEmail ? (<>
                          <button className={"add-link"} onClick={$v.cad?.addEmail}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 5v14M5 12h14"></path>
                            </svg>
                            {"Adicionar e-mail"}
                          </button>
                        </>) : null}
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                        {"\n                    "}
                        <span className={"cad-label"}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A15.1 15.1 0 0 1 3.4 6.1 1.6 1.6 0 0 1 5 4.5z"></path>
                          </svg>
                          {"Telefones · WhatsApp e ligação"}
                        </span>
                        {"\n                    "}
                        {__arr($v.cad?.fones).map((fn, $index) => (<React.Fragment key={$index}>
                          {"\n                      "}
                          <span className={"cad-field"}>
                            <input type="tel" value={__val(fn?.v)} onChange={fn?.mudar} aria-label={`Telefone ${__s(fn?.n)}`} placeholder="(11) 90000-0000" />
                            <button className={"icon-btn"} onClick={fn?.remover} aria-label={`Remover telefone ${__s(fn?.n)}`} title="Remover">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18"></path>
                              </svg>
                            </button>
                          </span>
                          {"\n                    "}
                        </React.Fragment>))}
                        {"\n                    "}
                        {$v.cad?.podeFone ? (<>
                          <button className={"add-link"} onClick={$v.cad?.addFone}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 5v14M5 12h14"></path>
                            </svg>
                            {"Adicionar telefone"}
                          </button>
                        </>) : null}
                        {"\n                  "}
                      </div>
                      {"\n                  "}
                      <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                        {"\n                    "}
                        <span className={"cad-label"}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                            <circle cx="12" cy="12" r="4"></circle>
                            <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"></circle>
                          </svg>
                          {"Instagram"}
                        </span>
                        {"\n                    "}
                        <span className={"cad-field"}>
                          <span style={{"color":"var(--graphite)"}}>
                            {"@"}
                          </span>
                          <input value={__val($v.cad?.ig)} onChange={$v.cad?.mudarIg} aria-label={`Instagram de ${__s($v.cad?.primeiro)}`} placeholder="usuario" />
                        </span>
                        {"\n                  "}
                      </div>
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n\n              "}
                  <section style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                    {"\n                "}
                    <div style={{"display":"flex","alignItems":"baseline","justifyContent":"space-between","gap":"10px","flexWrap":"wrap"}}>
                      <h3 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"18px"}}>
                        {"Fluxo da cadência"}
                      </h3>
                      <span style={{"fontSize":"12px","color":"var(--graphite)"}}>
                        {__t($v.cad?.resumo)}
                      </span>
                    </div>
                    {"\n                "}
                    <ol className={"tl cad-tl"}>
                      {"\n                  "}
                      {__arr($v.cad?.passos).map((p, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <li className={"tl-item"} data-done="true" data-canal={p?.canal}>
                          {"\n                      "}
                          <span className={"tl-ind cad-ind"}>
                            {p?.c_email ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect>
                                <path d="M4 7l8 6 8-6"></path>
                              </svg>
                            </>) : null}
                            {p?.c_linkedin ? (<>
                              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                              </svg>
                            </>) : null}
                            {p?.c_whatsapp ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"></path>
                                <path d="M9.2 8.6c.2 2.6 3.2 5.7 5.9 6 .6 0 1.3-.7 1.4-1.3l-1.8-.9-.9.9c-1-.4-2.4-1.8-2.8-2.8l.9-.9-.9-1.8c-.6.1-1.4.8-1.8 1.4z"></path>
                              </svg>
                            </>) : null}
                            {p?.c_ligacao ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A15.1 15.1 0 0 1 3.4 6.1 1.6 1.6 0 0 1 5 4.5z"></path>
                              </svg>
                            </>) : null}
                            {p?.c_instagram ? (<>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                                <circle cx="12" cy="12" r="4"></circle>
                                <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"></circle>
                              </svg>
                            </>) : null}
                          </span>
                          {"\n                      "}
                          <span className={"tl-sep"}></span>
                          {"\n                      "}
                          <div className={"cad-step"}>
                            {"\n                        "}
                            <div className={"cad-step-h"}>
                              {"\n                          "}
                              <span className={"cad-dia"}>
                                {"Dia "}{__t(p?.dia)}
                              </span>
                              {"\n                          "}
                              <div className={"seg seg-canal"} role="radiogroup" aria-label={`Canal do passo ${__s(p?.n)}`}>
                                {"\n                            "}
                                {__arr(p?.canais).map((o, $index) => (<React.Fragment key={$index}>
                                  <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                    {__t(o?.label)}
                                  </button>
                                </React.Fragment>))}
                                {"\n                          "}
                              </div>
                              {"\n                          "}
                              <span style={{"flex":"1 1 auto"}}></span>
                              {"\n                          "}
                              <button className={"icon-btn"} onClick={p?.subir} disabled={p?.primeiro} aria-label={`Mover passo ${__s(p?.n)} para cima`} title="Subir">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 18V6M7 11l5-5 5 5"></path>
                                </svg>
                              </button>
                              {"\n                          "}
                              <button className={"icon-btn"} onClick={p?.descer} disabled={p?.ultimo} aria-label={`Mover passo ${__s(p?.n)} para baixo`} title="Descer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 6v12M7 13l5 5 5-5"></path>
                                </svg>
                              </button>
                              {"\n                          "}
                              <button className={"icon-btn"} onClick={p?.remover} aria-label={`Remover passo ${__s(p?.n)}`} title="Remover">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"></path>
                                </svg>
                              </button>
                              {"\n                        "}
                            </div>
                            {"\n                        "}
                            <div className={"cad-espera"}>
                              {"\n                          "}
                              {p?.primeiro ? (<>
                                <span>
                                  {"Início da cadência"}
                                </span>
                              </>) : null}
                              {"\n                          "}
                              {p?.naoPrimeiro ? (<>
                                {"\n                            "}
                                <span>
                                  {"Aguardar"}
                                </span>
                                {"\n                            "}
                                <span className={"stepper"}>
                                  <button onClick={p?.menos} disabled={p?.minEspera} aria-label="Menos um dia">
                                    {"−"}
                                  </button>
                                  <span className={"num"}>
                                    {__t(p?.espera)}
                                  </span>
                                  <button onClick={p?.mais} aria-label="Mais um dia">
                                    {"+"}
                                  </button>
                                </span>
                                {"\n                            "}
                                <span>
                                  {__t(p?.diasTexto)}{" após o passo anterior"}
                                </span>
                                {"\n                          "}
                              </>) : null}
                              {"\n                          "}
                              <span style={{"flex":"1 1 auto"}}></span>
                              {"\n                          "}
                              {p?.auto ? (<>
                                <span className={"cad-aviso cad-aviso-auto"}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"></path>
                                  </svg>
                                  {__t(p?.avisoAuto)}
                                </span>
                              </>) : null}
                              {"\n                          "}
                              {p?.naoAuto ? (<>
                                <span className={"cad-aviso"}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M12 4c3.6 0 6 2.6 6 6.2V15l1.6 2.4H4.4L6 15v-4.8C6 6.6 8.4 4 12 4zM10 20h4"></path>
                                  </svg>
                                  {__t(p?.aviso)}
                                </span>
                              </>) : null}
                              {"\n                        "}
                            </div>
                            {"\n                        "}
                            <div className={"cad-modo"}>
                              {"\n                          "}
                              {p?.automatizavel ? (<>
                                {"\n                            "}
                                <div className={"seg seg-li"} role="radiogroup" aria-label={`Como o passo ${__s(p?.n)} é enviado`}>
                                  {__arr(p?.modos).map((o, $index) => (<React.Fragment key={$index}>
                                    <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                      {__t(o?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                          "}
                              </>) : null}
                              {"\n                          "}
                              {p?.soManual ? (<>
                                <span className={"cad-manual"}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0v5"></path>
                                    <path d="M10.8 11V5.4a1.4 1.4 0 0 1 2.8 0V11"></path>
                                    <path d="M13.6 11V6.6a1.4 1.4 0 0 1 2.8 0v6.2"></path>
                                    <path d="M16.4 10.4a1.4 1.4 0 0 1 2.8 0v3.4a7 7 0 0 1-7 7h-.6a6.6 6.6 0 0 1-5.2-2.6l-2.3-3a1.5 1.5 0 0 1 2.3-1.9L8 15"></path>
                                  </svg>
                                  {"Só manual"}
                                </span>
                              </>) : null}
                              {"\n                          "}
                              <span className={"cad-hint"} style={{"flex":"1 1 220px"}}>
                                {__t(p?.modoTexto)}
                              </span>
                              {"\n                        "}
                            </div>
                            {"\n\n                        "}
                            {p?.c_email ? (<>
                              {"\n                          "}
                              <div className={"cad-cfg"}>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Enviar para"}
                                </span>
                                {"\n                            "}
                                <div className={"chips"}>
                                  {__arr(p?.alvos).map((a, $index) => (<React.Fragment key={$index}>
                                    <button className={"chip"} aria-pressed={a?.ativo} onClick={a?.escolher}>
                                      {__t(a?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                            "}
                                <input className={"cad-input"} value={__val(p?.assunto)} onChange={p?.mudarAssunto} placeholder="Assunto" aria-label="Assunto do e-mail" />
                                {"\n                            "}
                                <textarea className={"cad-input"} rows="4" value={__val(p?.texto)} onChange={p?.mudarTexto} placeholder="Mensagem" aria-label="Corpo do e-mail"></textarea>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </>) : null}
                            {"\n                        "}
                            {p?.c_linkedin ? (<>
                              {"\n                          "}
                              <div className={"cad-cfg"}>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Ação no LinkedIn"}
                                </span>
                                {"\n                            "}
                                <div className={"seg seg-li"} role="radiogroup" aria-label="Ação no LinkedIn">
                                  {__arr(p?.liTipos).map((o, $index) => (<React.Fragment key={$index}>
                                    <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                      {__t(o?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                            "}
                                {p?.liTemTexto ? (<>
                                  {"\n                              "}
                                  <textarea className={"cad-input"} rows="3" value={__val(p?.texto)} onChange={p?.mudarTexto} maxLength={p?.liMax} placeholder={p?.liPlaceholder} aria-label="Texto do LinkedIn"></textarea>
                                  {"\n                              "}
                                  <span className={"cad-hint"} style={{"textAlign":"right"}}>
                                    {__t(p?.liContagem)}
                                  </span>
                                  {"\n                            "}
                                </>) : null}
                                {"\n                            "}
                                {p?.liSoConexao ? (<>
                                  <span className={"cad-hint"}>
                                    {"Envia o convite sem nota. A plataforma avisa quando "}{__t($v.cad?.primeiro)}{" aceitar."}
                                  </span>
                                </>) : null}
                                {"\n                            "}
                                <a className={"cad-acao"} href={p?.liHref} target="_blank" rel="noopener" onClick={p?.liAcao}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                                  </svg>
                                  {__t(p?.liAcaoLabel)}
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M14 4h6v6M20 4l-9 9"></path>
                                    <path d="M18 14v5H5V6h5"></path>
                                  </svg>
                                </a>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </>) : null}
                            {"\n                        "}
                            {p?.c_whatsapp ? (<>
                              {"\n                          "}
                              <div className={"cad-cfg"}>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Número"}
                                </span>
                                {"\n                            "}
                                <div className={"chips"}>
                                  {__arr(p?.alvos).map((a, $index) => (<React.Fragment key={$index}>
                                    <button className={"chip"} aria-pressed={a?.ativo} onClick={a?.escolher}>
                                      {__t(a?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                            "}
                                <textarea className={"cad-input"} rows="3" value={__val(p?.texto)} onChange={p?.mudarTexto} placeholder="Mensagem do WhatsApp" aria-label="Mensagem do WhatsApp"></textarea>
                                {"\n                            "}
                                <a className={"cad-acao cad-acao-wa"} href={p?.waLink} target="_blank" rel="noopener">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"></path>
                                    <path d="M9.2 8.6c.2 2.6 3.2 5.7 5.9 6 .6 0 1.3-.7 1.4-1.3l-1.8-.9-.9.9c-1-.4-2.4-1.8-2.8-2.8l.9-.9-.9-1.8c-.6.1-1.4.8-1.8 1.4z"></path>
                                  </svg>
                                  {"Abrir conversa com a mensagem pronta"}
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M14 4h6v6M20 4l-9 9"></path>
                                    <path d="M18 14v5H5V6h5"></path>
                                  </svg>
                                </a>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </>) : null}
                            {"\n                        "}
                            {p?.c_instagram ? (<>
                              {"\n                          "}
                              <div className={"cad-cfg"}>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Ação no Instagram"}
                                </span>
                                {"\n                            "}
                                <div className={"seg seg-li"} role="radiogroup" aria-label="Ação no Instagram">
                                  {__arr(p?.igTipos).map((o, $index) => (<React.Fragment key={$index}>
                                    <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                                      {__t(o?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                            "}
                                {p?.igTemTexto ? (<>
                                  <textarea className={"cad-input"} rows="3" value={__val(p?.texto)} onChange={p?.mudarTexto} placeholder="Mensagem direta" aria-label="Mensagem do Instagram"></textarea>
                                </>) : null}
                                {"\n                            "}
                                {p?.igSoSeguir ? (<>
                                  <span className={"cad-hint"}>
                                    {"Seguir antes faz seu nome aparecer para "}{__t($v.cad?.primeiro)}{" antes da mensagem. Bom para abrir caminho no dia anterior ao direct."}
                                  </span>
                                </>) : null}
                                {"\n                            "}
                                {p?.igSemPerfil ? (<>
                                  <span className={"cad-hint"} style={{"color":"var(--warn)"}}>
                                    {"Falta o @ do Instagram de "}{__t($v.cad?.primeiro)}{". Preencha em Contatos, lá em cima."}
                                  </span>
                                </>) : null}
                                {"\n                            "}
                                <a className={"cad-acao cad-acao-ig"} href={p?.igHref} target="_blank" rel="noopener" onClick={p?.igAcao}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                                    <circle cx="12" cy="12" r="4"></circle>
                                    <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"></circle>
                                  </svg>
                                  {__t(p?.igAcaoLabel)}
                                </a>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </>) : null}
                            {"\n                        "}
                            {p?.c_ligacao ? (<>
                              {"\n                          "}
                              <div className={"cad-cfg"}>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Número"}
                                </span>
                                {"\n                            "}
                                <div className={"chips"}>
                                  {__arr(p?.alvos).map((a, $index) => (<React.Fragment key={$index}>
                                    <button className={"chip"} aria-pressed={a?.ativo} onClick={a?.escolher}>
                                      {__t(a?.label)}
                                    </button>
                                  </React.Fragment>))}
                                </div>
                                {"\n                            "}
                                <span className={"cad-label"}>
                                  {"Roteiro da ligação"}
                                </span>
                                {"\n                            "}
                                <textarea className={"cad-input"} rows="5" value={__val(p?.texto)} onChange={p?.mudarTexto} placeholder="Abertura, perguntas e próximo passo" aria-label="Roteiro da ligação"></textarea>
                                {"\n                            "}
                                <a className={"cad-acao"} href={p?.telLink}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A15.1 15.1 0 0 1 3.4 6.1 1.6 1.6 0 0 1 5 4.5z"></path>
                                  </svg>
                                  {"Ligar agora"}
                                </a>
                                {"\n                          "}
                              </div>
                              {"\n                        "}
                            </>) : null}
                            {"\n                      "}
                          </div>
                          {"\n                    "}
                        </li>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </ol>
                    {"\n                "}
                    <div className={"add-passo"}>
                      {"\n                  "}
                      <span style={{"fontSize":"13px","color":"var(--graphite)"}}>
                        {"Adicionar passo"}
                      </span>
                      {"\n                  "}
                      {__arr($v.cad?.novos).map((o, $index) => (<React.Fragment key={$index}>
                        <button className={"b-sec mini-btn"} onClick={o?.add}>
                          {o?.c_email ? (<>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect>
                              <path d="M4 7l8 6 8-6"></path>
                            </svg>
                          </>) : null}
                          {o?.c_linkedin ? (<>
                            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                              <path fill="currentColor" d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.6 9h3.3v11.5H3.6zM9.1 9h3.2v1.6h.1c.4-.8 1.5-1.9 3.2-1.9 3.4 0 4 2.2 4 5.1v5.7h-3.3v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.1z"></path>
                            </svg>
                          </>) : null}
                          {o?.c_whatsapp ? (<>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"></path>
                              <path d="M9.2 8.6c.2 2.6 3.2 5.7 5.9 6 .6 0 1.3-.7 1.4-1.3l-1.8-.9-.9.9c-1-.4-2.4-1.8-2.8-2.8l.9-.9-.9-1.8c-.6.1-1.4.8-1.8 1.4z"></path>
                            </svg>
                          </>) : null}
                          {o?.c_ligacao ? (<>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A15.1 15.1 0 0 1 3.4 6.1 1.6 1.6 0 0 1 5 4.5z"></path>
                            </svg>
                          </>) : null}
                          {o?.c_instagram ? (<>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                              <circle cx="12" cy="12" r="4"></circle>
                              <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"></circle>
                            </svg>
                          </>) : null}
                          {__t(o?.label)}
                        </button>
                      </React.Fragment>))}
                      {"\n                "}
                    </div>
                    {"\n              "}
                  </section>
                  {"\n            "}
                </>) : null}
                {"\n          "}
              </>) : null}
              {"\n        "}
            </div>
            {"\n        "}
            {$v.cta?.rodapeCad ? (<>
              {"\n          "}
              <div style={{"flex":"0 0 auto","padding":"12px 20px","borderTop":"1px solid var(--rule)","display":"flex","alignItems":"center","gap":"12px","flexWrap":"wrap"}}>
                {"\n            "}
                <span style={{"flex":"1 1 220px","fontSize":"12px","color":"var(--graphite)","display":"flex","alignItems":"center","gap":"6px"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4c3.6 0 6 2.6 6 6.2V15l1.6 2.4H4.4L6 15v-4.8C6 6.6 8.4 4 12 4zM10 20h4"></path>
                  </svg>
                  {__t($v.cad?.rodape)}
                </span>
                {"\n            "}
                {$v.cad?.salvo ? (<>
                  <span role="status" style={{"fontSize":"13px","color":"var(--ok)"}}>
                    {"Cadência salva"}
                  </span>
                </>) : null}
                {"\n            "}
                <button className={"b-pri"} onClick={$v.cad?.salvar} style={{"height":"40px","padding":"0 18px","border":"1px solid var(--ink)","borderRadius":"10px","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"14px","fontWeight":"500","cursor":"pointer"}}>
                  {"Salvar cadência"}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n      "}
          </aside>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.oa?.aberto ? (<>
          {"\n      "}
          <div onClick={$v.oa?.fechar} style={{"position":"fixed","inset":"0","zIndex":"95","background":"var(--veil)"}}></div>
          {"\n      "}
          <div className={"oa-modal"} role="dialog" aria-modal="true" aria-label={`Conectar ${__s($v.oa?.nome)}`}>
            {"\n        "}
            <div className={"oa-head"}>
              {"\n          "}
              <span className={"oa-par"}>
                <span className={"oa-a"}>
                  <svg viewBox="0 0 352 299" style={{"width":"30px","height":"26px"}} aria-hidden="true">
                    <path d="M115 0L0 299H81L127 61L169 299H251L141 0Z" fill="#F4F4F4"></path>
                    <circle cx="308" cy="43" r="40" fill="#F7054F"></circle>
                  </svg>
                </span>
                <span className={"oa-ponte"} aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span className={"con-logo con-logo-lg"}>
                  <img src={$v.oa?.logo} alt={`Logo ${__s($v.oa?.nome)}`} />
                </span>
              </span>
              {"\n          "}
              <button className={"icon-btn"} onClick={$v.oa?.fechar} aria-label="Fechar" style={{"position":"absolute","top":"12px","right":"12px"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
              {"\n        "}
            </div>
            {"\n        "}
            {$v.oa?.passoInicio ? (<>
              {"\n          "}
              <div className={"oa-body"}>
                {"\n            "}
                <h2 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"24px","textAlign":"center"}}>
                  {"Conectar "}{__t($v.oa?.nome)}
                </h2>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)","textAlign":"center","textWrap":"balance"}}>
                  {"Você vai entrar na página oficial da "}{__t($v.oa?.empresa)}{" para autorizar. A Althius recebe um token de acesso e nunca vê sua senha."}
                </p>
                {"\n            "}
                <div className={"oa-box"}>
                  {"\n              "}
                  <span className={"cad-label"}>
                    {"A Althius poderá"}
                  </span>
                  {"\n              "}
                  {__arr($v.oa?.escopos).map((e, $index) => (<React.Fragment key={$index}>
                    <span className={"oa-escopo"}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                      </svg>
                      <span>
                        {__t(e)}
                      </span>
                    </span>
                  </React.Fragment>))}
                  {"\n            "}
                </div>
                {"\n            "}
                <div className={"oa-box"}>
                  {"\n              "}
                  <span className={"cad-label"}>
                    {"Agentes que podem usar"}
                  </span>
                  {"\n              "}
                  <div className={"chips"}>
                    {__arr($v.oa?.agentes).map((ag, $index) => (<React.Fragment key={$index}>
                      <button className={"chip"} aria-pressed={ag?.ativo} onClick={ag?.alternar}>
                        {__t(ag?.nome)}
                      </button>
                    </React.Fragment>))}
                  </div>
                  {"\n            "}
                </div>
                {"\n            "}
                <button className={"b-pri oa-cta"} onClick={$v.oa?.continuar}>
                  {"Continuar com "}{__t($v.oa?.empresa)}
                </button>
                {"\n            "}
                <span className={"con-auth"} style={{"justifyContent":"center"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                  </svg>
                  {__t($v.oa?.auth)}{" · você pode revogar quando quiser"}
                </span>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.oa?.passoAguardando ? (<>
              {"\n          "}
              <div className={"oa-body"} role="status" style={{"alignItems":"center","textAlign":"center","paddingBottom":"36px"}}>
                {"\n            "}
                <span style={{"color":"var(--ink)"}}>
                  <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"28px"}}>
                    <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                  </svg>
                </span>
                {"\n            "}
                <h2 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"22px"}}>
                  {"Aguardando autorização"}
                </h2>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)","textWrap":"balance"}}>
                  {"Conclua o login na janela da "}{__t($v.oa?.empresa)}{". Esta tela atualiza sozinha quando a autorização voltar."}
                </p>
                {"\n            "}
                <button className={"b-sec mini-btn"} onClick={$v.oa?.cancelar}>
                  {"Cancelar"}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n        "}
            {$v.oa?.passoOk ? (<>
              {"\n          "}
              <div className={"oa-body"} style={{"alignItems":"center","textAlign":"center"}}>
                {"\n            "}
                <span className={"oa-ok"}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                  </svg>
                </span>
                {"\n            "}
                <h2 style={{"margin":"0","fontFamily":"var(--f-display)","fontWeight":"400","fontSize":"22px"}}>
                  {__t($v.oa?.nome)}{" conectado"}
                </h2>
                {"\n            "}
                <p style={{"margin":"0","fontSize":"14px","color":"var(--graphite)"}}>
                  {"Conta "}{__t($v.oa?.conta)}{" · disponível para "}{__t($v.oa?.usoTexto)}{"."}
                </p>
                {"\n            "}
                <button className={"b-pri oa-cta"} onClick={$v.oa?.fechar}>
                  {"Concluir"}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </>) : null}
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.cm?.aberto ? (<>
          {"\n      "}
          <div onClick={$v.cm?.fechar} style={{"position":"fixed","inset":"0","zIndex":"95","background":"var(--veil)"}}></div>
          {"\n      "}
          <div className={"oa-modal cm-modal"} role="dialog" aria-modal="true" aria-label={$v.cm?.titulo}>
            {"\n        "}
            <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"18px 20px 10px"}}>
              <span style={{"flex":"1 1 auto","fontFamily":"var(--f-display)","fontSize":"22px"}}>
                {__t($v.cm?.titulo)}
              </span>
              <button className={"icon-btn"} onClick={$v.cm?.fechar} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>
            {"\n        "}
            <div style={{"display":"flex","flexDirection":"column","gap":"14px","padding":"4px 20px 20px"}}>
              {"\n          "}
              {$v.cm?.podeNome ? (<>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Nome do canal"}
                  </span>
                  <span className={"cad-field"}>
                    <span style={{"color":"var(--graphite)"}}>
                      {"#"}
                    </span>
                    <input value={__val($v.cm?.nome)} onChange={$v.cm?.mudarNome} placeholder="ex.: expansao-sul" aria-label="Nome do canal" />
                  </span>
                  <em>
                    {__t($v.cm?.slugTexto)}
                  </em>
                </label>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Descrição"}
                  </span>
                  <input value={__val($v.cm?.desc)} onChange={$v.cm?.mudarDesc} placeholder="Para que serve este canal" />
                </label>
                {"\n          "}
              </>) : null}
              {"\n          "}
              <div className={"oa-box"}>
                {"\n            "}
                <span className={"cad-label"}>
                  {"Pessoas"}
                  <span style={{"fontWeight":"400"}}>
                    {" · "}{__t($v.cm?.nPessoas)}
                  </span>
                </span>
                {"\n            "}
                {$v.cm?.geral ? (<>
                  <span style={{"display":"inline-flex","alignItems":"center","gap":"6px","fontSize":"13px","color":"var(--graphite)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                    </svg>
                    {"Todos os membros do workspace participam do #geral. Quem entra no workspace entra aqui."}
                  </span>
                </>) : null}
                {"\n            "}
                <div className={"chips"}>
                  {__arr($v.cm?.pessoas).map((p, $index) => (<React.Fragment key={$index}>
                    <button className={"chip chip-pessoa"} aria-pressed={p?.ativo} onClick={p?.alternar} disabled={p?.travado}>
                      <span className={"membro-av"} style={{"width":"20px","height":"20px","fontSize":"9px"}}>
                        {__t(p?.sigla)}
                        {p?.temFoto ? (<>
                          <img className={"foto"} src={p?.foto} alt="" />
                        </>) : null}
                      </span>
                      {__t(p?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
                {"\n          "}
              </div>
              {"\n          "}
              <div className={"oa-box"}>
                {"\n            "}
                <span className={"cad-label"}>
                  {"Agentes"}
                  <span style={{"fontWeight":"400"}}>
                    {" · respondem quando alguém usa @ no canal"}
                  </span>
                </span>
                {"\n            "}
                <div className={"chips"}>
                  {__arr($v.cm?.agentes).map((a, $index) => (<React.Fragment key={$index}>
                    <button className={"chip chip-pessoa"} aria-pressed={a?.ativo} onClick={a?.alternar}>
                      <span className={"msg-av msg-av-agente"} style={{"width":"20px","height":"20px","fontSize":"9px","borderRadius":"5px"}}>
                        {__t(a?.sigla)}
                      </span>
                      {__t(a?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
                {"\n          "}
              </div>
              {"\n          "}
              {$v.cm?.temErro ? (<>
                <div className={"cfg-erro"} role="alert" style={{"margin":"0"}}>
                  {__t($v.cm?.erro)}
                </div>
              </>) : null}
              {"\n          "}
              <div style={{"display":"flex","justifyContent":"space-between","gap":"8px","flexWrap":"wrap"}}>
                {"\n            "}
                {$v.cm?.podeArquivar ? (<>
                  <button className={"b-sec mini-btn"} style={{"height":"40px","color":"var(--err)"}} onClick={$v.cm?.arquivar}>
                    {"Arquivar canal"}
                  </button>
                </>) : null}
                {"\n            "}
                <span style={{"flex":"1 1 auto"}}></span>
                {"\n            "}
                <button className={"b-sec mini-btn"} style={{"height":"40px"}} onClick={$v.cm?.fechar}>
                  {"Cancelar"}
                </button>
                {"\n            "}
                <button className={"b-pri cfg-salvar"} onClick={$v.cm?.salvar}>
                  {__t($v.cm?.salvarLabel)}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.tf?.aberto ? (<>
          {"\n      "}
          <div onClick={$v.tf?.fechar} style={{"position":"fixed","inset":"0","zIndex":"95","background":"var(--veil)"}}></div>
          {"\n      "}
          <div className={"oa-modal cm-modal"} role="dialog" aria-modal="true" aria-label="Nova tarefa" style={{"width":"min(620px, calc(100vw - 32px))"}}>
            {"\n        "}
            <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"18px 20px 10px"}}>
              <span style={{"flex":"1 1 auto","fontFamily":"var(--f-display)","fontSize":"22px"}}>
                {"Nova tarefa"}
              </span>
              <button className={"icon-btn"} onClick={$v.tf?.fechar} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>
            {"\n        "}
            <div style={{"display":"flex","flexDirection":"column","gap":"14px","padding":"4px 20px 20px"}}>
              {"\n          "}
              <label className={"cfg-campo"}>
                <span>
                  {"O que precisa ser feito"}
                </span>
                <input value={__val($v.tf?.titulo)} onChange={$v.tf?.mudarTitulo} placeholder="Ex.: Ligar para Aline e confirmar a reunião" />
              </label>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Canal"}
                </span>
                <div className={"chips"}>
                  {__arr($v.tf?.canais).map((o, $index) => (<React.Fragment key={$index}>
                    <button className={"chip"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                      {__t(o?.label)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <div className={"cfg-grid"} style={{"padding":"0","gridTemplateColumns":"repeat(2, minmax(0, 1fr))"}}>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Conta"}
                  </span>
                  <select className={"cfg-select"} value={__val($v.tf?.conta)} onChange={$v.tf?.mudarConta} style={{"height":"40px"}}>
                    <option value={__val("")}>
                      {"Sem conta"}
                    </option>
                    <option value={__val("a1")}>
                      {"Serra Azul Têxtil"}
                    </option>
                    <option value={__val("a2")}>
                      {"Campo Belo Agro"}
                    </option>
                    <option value={__val("a3")}>
                      {"Metalúrgica Ipê"}
                    </option>
                    <option value={__val("a4")}>
                      {"Delta Saúde"}
                    </option>
                    <option value={__val("a5")}>
                      {"Rio Claro Cosméticos"}
                    </option>
                    <option value={__val("a6")}>
                      {"Norte Log Transportes"}
                    </option>
                    <option value={__val("a7")}>
                      {"Grão Norte Alimentos"}
                    </option>
                    <option value={__val("a8")}>
                      {"Vértice Indústria"}
                    </option>
                  </select>
                </label>
                {"\n            "}
                <div className={"cfg-campo"}>
                  <span>
                    {"Contato"}
                  </span>
                  <div className={"chips"}>
                    {__arr($v.tf?.contatos).map((o, $index) => (<React.Fragment key={$index}>
                      <button className={"chip chip-pessoa"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                        <img className={"foto foto-xs"} src={o?.foto} alt="" style={{"width":"18px","height":"18px"}} />
                        {__t(o?.nome)}
                      </button>
                    </React.Fragment>))}
                    {$v.tf?.semContatos ? (<>
                      <span style={{"fontSize":"12px","fontWeight":"400","color":"var(--muted)"}}>
                        {__t($v.tf?.contatosVazio)}
                      </span>
                    </>) : null}
                  </div>
                </div>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Data"}
                  </span>
                  <input type="date" value={__val($v.tf?.data)} onChange={$v.tf?.mudarData} />
                </label>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Horário"}
                  </span>
                  <input type="time" value={__val($v.tf?.hora)} onChange={$v.tf?.mudarHora} />
                </label>
                {"\n          "}
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Responsável"}
                </span>
                <div className={"chips"}>
                  {__arr($v.tf?.resps).map((o, $index) => (<React.Fragment key={$index}>
                    <button className={"chip chip-pessoa"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                      <span className={"membro-av"} style={{"width":"18px","height":"18px","fontSize":"8px"}}>
                        {__t(o?.sigla)}
                        {o?.temFoto ? (<>
                          <img className={"foto"} src={o?.foto} alt="" />
                        </>) : null}
                      </span>
                      {__t(o?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Marcar agente "}
                  <span style={{"fontWeight":"400","color":"var(--muted)"}}>
                    {"· opcional, ele prepara o material da tarefa"}
                  </span>
                </span>
                <div className={"chips"}>
                  {__arr($v.tf?.agentes).map((o, $index) => (<React.Fragment key={$index}>
                    <button className={"chip chip-pessoa"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                      <span className={"msg-av msg-av-agente"} style={{"width":"18px","height":"18px","fontSize":"8px","borderRadius":"5px"}}>
                        {__t(o?.sigla)}
                      </span>
                      {__t(o?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Status"}
                </span>
                <div className={"seg seg-li"} role="radiogroup" aria-label="Status">
                  {__arr($v.tf?.status).map((o, $index) => (<React.Fragment key={$index}>
                    <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                      {__t(o?.label)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <label className={"cfg-campo"}>
                <span>
                  {"Anotação"}
                </span>
                <textarea className={"cad-input"} rows="3" value={__val($v.tf?.nota)} onChange={$v.tf?.mudarNota} placeholder="Contexto, roteiro ou o que combinar"></textarea>
              </label>
              {"\n          "}
              {$v.tf?.temErro ? (<>
                <div className={"cfg-erro"} role="alert" style={{"margin":"0"}}>
                  {__t($v.tf?.erro)}
                </div>
              </>) : null}
              {"\n          "}
              <div style={{"display":"flex","justifyContent":"flex-end","gap":"8px"}}>
                <span style={{"flex":"1 1 auto","fontSize":"12px","color":"var(--graphite)","alignSelf":"center"}}>
                  {"O responsável recebe uma notificação no horário marcado."}
                </span>
                <button className={"b-sec mini-btn"} style={{"height":"40px"}} onClick={$v.tf?.fechar}>
                  {"Cancelar"}
                </button>
                <button className={"b-pri cfg-salvar"} onClick={$v.tf?.salvar}>
                  {"Criar tarefa"}
                </button>
              </div>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.pd?.aberto ? (<>
          {"\n      "}
          <div onClick={$v.pd?.fechar} style={{"position":"fixed","inset":"0","zIndex":"95","background":"var(--veil)"}}></div>
          {"\n      "}
          <div className={"oa-modal cm-modal"} role="dialog" aria-modal="true" aria-label={$v.pd?.titulo} style={{"width":"min(600px, calc(100vw - 32px))"}}>
            {"\n        "}
            <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"18px 20px 10px"}}>
              <span style={{"flex":"1 1 auto","fontFamily":"var(--f-display)","fontSize":"22px"}}>
                {__t($v.pd?.titulo)}
              </span>
              <button className={"icon-btn"} onClick={$v.pd?.fechar} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>
            {"\n        "}
            <div style={{"display":"flex","flexDirection":"column","gap":"14px","padding":"4px 20px 20px"}}>
              {"\n          "}
              <div className={"cfg-grid"} style={{"padding":"0","gridTemplateColumns":"repeat(2, minmax(0, 1fr))"}}>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Conta"}
                  </span>
                  <select className={"cfg-select"} value={__val($v.pd?.conta)} onChange={$v.pd?.mudarConta} style={{"height":"40px"}}>
                    <option value={__val("")}>
                      {"Escolha a conta"}
                    </option>
                    <option value={__val("a1")}>
                      {"Serra Azul Têxtil"}
                    </option>
                    <option value={__val("a2")}>
                      {"Campo Belo Agro"}
                    </option>
                    <option value={__val("a3")}>
                      {"Metalúrgica Ipê"}
                    </option>
                    <option value={__val("a4")}>
                      {"Delta Saúde"}
                    </option>
                    <option value={__val("a5")}>
                      {"Rio Claro Cosméticos"}
                    </option>
                    <option value={__val("a6")}>
                      {"Norte Log Transportes"}
                    </option>
                    <option value={__val("a7")}>
                      {"Grão Norte Alimentos"}
                    </option>
                    <option value={__val("a8")}>
                      {"Vértice Indústria"}
                    </option>
                  </select>
                </label>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Valor (R$)"}
                  </span>
                  <input inputMode="numeric" value={__val($v.pd?.valor)} onChange={$v.pd?.mudarValor} placeholder="25000" />
                </label>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Previsão de fechamento"}
                  </span>
                  <input type="date" value={__val($v.pd?.fecha)} onChange={$v.pd?.mudarFecha} />
                </label>
                {"\n            "}
                <label className={"cfg-campo"}>
                  <span>
                    {"Chance de ganho · "}{__t($v.pd?.prob)}{"%"}
                  </span>
                  <input type="range" min="0" max="100" step="5" value={__val($v.pd?.prob)} onChange={$v.pd?.mudarProb} style={{"accentColor":"var(--ink)"}} />
                </label>
                {"\n          "}
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Etapa"}
                </span>
                <div className={"chips"}>
                  {__arr($v.pd?.etapas).map((o, $index) => (<React.Fragment key={$index}>
                    <button className={"chip"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                      {__t(o?.label)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Situação"}
                </span>
                <div className={"seg seg-li"} role="radiogroup" aria-label="Situação">
                  {__arr($v.pd?.situacoes).map((o, $index) => (<React.Fragment key={$index}>
                    <button role="radio" aria-checked={o?.ativo} onClick={o?.escolher}>
                      {__t(o?.label)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              <div className={"cfg-campo"}>
                <span>
                  {"Responsável"}
                </span>
                <div className={"chips"}>
                  {__arr($v.pd?.donos).map((o, $index) => (<React.Fragment key={$index}>
                    <button className={"chip chip-pessoa"} aria-pressed={o?.ativo} onClick={o?.escolher}>
                      <span className={"membro-av"} style={{"width":"18px","height":"18px","fontSize":"8px"}}>
                        {__t(o?.sigla)}
                        {o?.temFoto ? (<>
                          <img className={"foto"} src={o?.foto} alt="" />
                        </>) : null}
                      </span>
                      {__t(o?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
              {"\n          "}
              {$v.pd?.temErro ? (<>
                <div className={"cfg-erro"} role="alert" style={{"margin":"0"}}>
                  {__t($v.pd?.erro)}
                </div>
              </>) : null}
              {"\n          "}
              <div style={{"display":"flex","gap":"8px","flexWrap":"wrap","alignItems":"center"}}>
                {"\n            "}
                {$v.pd?.editando ? (<>
                  <button className={"b-sec mini-btn"} style={{"height":"40px","color":"var(--err)"}} onClick={$v.pd?.remover}>
                    {"Remover"}
                  </button>
                  {$v.pd?.temConta ? (<>
                    <button className={"b-ghost mini-btn"} style={{"height":"40px"}} onClick={$v.pd?.verConta}>
                      {"Ver comitê da conta"}
                    </button>
                  </>) : null}
                </>) : null}
                {"\n            "}
                <span style={{"flex":"1 1 auto"}}></span>
                {"\n            "}
                <button className={"b-sec mini-btn"} style={{"height":"40px"}} onClick={$v.pd?.fechar}>
                  {"Cancelar"}
                </button>
                {"\n            "}
                <button className={"b-pri cfg-salvar"} onClick={$v.pd?.salvar}>
                  {__t($v.pd?.salvarLabel)}
                </button>
                {"\n          "}
              </div>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.ixm?.aberto ? (<>
          {"\n      "}
          <div onClick={$v.ixm?.fechar} style={{"position":"fixed","inset":"0","zIndex":"95","background":"var(--veil)"}}></div>
          {"\n      "}
          <div className={"oa-modal cm-modal"} role="dialog" aria-modal="true" aria-label={`Conectar ${__s($v.ixm?.nome)}`} style={{"width":"min(520px, calc(100vw - 32px))"}}>
            {"\n        "}
            <div style={{"display":"flex","alignItems":"center","gap":"12px","padding":"18px 20px 10px"}}>
              <span className={"con-logo"}>
                <img src={$v.ixm?.logo} alt="" />
              </span>
              <span style={{"flex":"1 1 auto","fontFamily":"var(--f-display)","fontSize":"22px"}}>
                {"Conectar "}{__t($v.ixm?.nome)}
              </span>
              <button className={"icon-btn"} onClick={$v.ixm?.fechar} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>
            {"\n        "}
            <div style={{"display":"flex","flexDirection":"column","gap":"14px","padding":"4px 20px 20px"}}>
              {"\n          "}
              {$v.ixm?.qr ? (<>
                {"\n            "}
                <div className={"ix-qr"}>
                  <span className={"ix-qr-img"}>
                    <svg width="168" height="168" viewBox="-1 -1 27 27" fill="currentColor" aria-hidden="true" shapeRendering="crispEdges">
                      <rect x="0.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1"></rect>
                      <rect x="2.5" y="2.5" width="3" height="3"></rect>
                      <rect x="17.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1"></rect>
                      <rect x="19.5" y="2.5" width="3" height="3"></rect>
                      <rect x="0.5" y="17.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1"></rect>
                      <rect x="2.5" y="19.5" width="3" height="3"></rect>
                      <rect x="8" y="0" width="1" height="1"></rect>
                      <rect x="9" y="0" width="1" height="1"></rect>
                      <rect x="11" y="0" width="1" height="1"></rect>
                      <rect x="13" y="0" width="1" height="1"></rect>
                      <rect x="14" y="0" width="1" height="1"></rect>
                      <rect x="16" y="0" width="1" height="1"></rect>
                      <rect x="8" y="1" width="1" height="1"></rect>
                      <rect x="9" y="1" width="1" height="1"></rect>
                      <rect x="10" y="1" width="1" height="1"></rect>
                      <rect x="11" y="1" width="1" height="1"></rect>
                      <rect x="13" y="1" width="1" height="1"></rect>
                      <rect x="14" y="1" width="1" height="1"></rect>
                      <rect x="9" y="2" width="1" height="1"></rect>
                      <rect x="11" y="2" width="1" height="1"></rect>
                      <rect x="13" y="2" width="1" height="1"></rect>
                      <rect x="14" y="2" width="1" height="1"></rect>
                      <rect x="15" y="2" width="1" height="1"></rect>
                      <rect x="16" y="2" width="1" height="1"></rect>
                      <rect x="9" y="3" width="1" height="1"></rect>
                      <rect x="12" y="3" width="1" height="1"></rect>
                      <rect x="14" y="3" width="1" height="1"></rect>
                      <rect x="15" y="3" width="1" height="1"></rect>
                      <rect x="16" y="3" width="1" height="1"></rect>
                      <rect x="9" y="4" width="1" height="1"></rect>
                      <rect x="10" y="4" width="1" height="1"></rect>
                      <rect x="12" y="4" width="1" height="1"></rect>
                      <rect x="13" y="4" width="1" height="1"></rect>
                      <rect x="16" y="4" width="1" height="1"></rect>
                      <rect x="12" y="5" width="1" height="1"></rect>
                      <rect x="14" y="5" width="1" height="1"></rect>
                      <rect x="15" y="5" width="1" height="1"></rect>
                      <rect x="8" y="6" width="1" height="1"></rect>
                      <rect x="10" y="6" width="1" height="1"></rect>
                      <rect x="15" y="6" width="1" height="1"></rect>
                      <rect x="10" y="7" width="1" height="1"></rect>
                      <rect x="15" y="7" width="1" height="1"></rect>
                      <rect x="3" y="8" width="1" height="1"></rect>
                      <rect x="4" y="8" width="1" height="1"></rect>
                      <rect x="6" y="8" width="1" height="1"></rect>
                      <rect x="8" y="8" width="1" height="1"></rect>
                      <rect x="9" y="8" width="1" height="1"></rect>
                      <rect x="10" y="8" width="1" height="1"></rect>
                      <rect x="12" y="8" width="1" height="1"></rect>
                      <rect x="13" y="8" width="1" height="1"></rect>
                      <rect x="14" y="8" width="1" height="1"></rect>
                      <rect x="16" y="8" width="1" height="1"></rect>
                      <rect x="17" y="8" width="1" height="1"></rect>
                      <rect x="22" y="8" width="1" height="1"></rect>
                      <rect x="23" y="8" width="1" height="1"></rect>
                      <rect x="24" y="8" width="1" height="1"></rect>
                      <rect x="2" y="9" width="1" height="1"></rect>
                      <rect x="3" y="9" width="1" height="1"></rect>
                      <rect x="4" y="9" width="1" height="1"></rect>
                      <rect x="5" y="9" width="1" height="1"></rect>
                      <rect x="8" y="9" width="1" height="1"></rect>
                      <rect x="9" y="9" width="1" height="1"></rect>
                      <rect x="10" y="9" width="1" height="1"></rect>
                      <rect x="11" y="9" width="1" height="1"></rect>
                      <rect x="18" y="9" width="1" height="1"></rect>
                      <rect x="23" y="9" width="1" height="1"></rect>
                      <rect x="24" y="9" width="1" height="1"></rect>
                      <rect x="0" y="10" width="1" height="1"></rect>
                      <rect x="2" y="10" width="1" height="1"></rect>
                      <rect x="3" y="10" width="1" height="1"></rect>
                      <rect x="4" y="10" width="1" height="1"></rect>
                      <rect x="5" y="10" width="1" height="1"></rect>
                      <rect x="6" y="10" width="1" height="1"></rect>
                      <rect x="7" y="10" width="1" height="1"></rect>
                      <rect x="8" y="10" width="1" height="1"></rect>
                      <rect x="9" y="10" width="1" height="1"></rect>
                      <rect x="10" y="10" width="1" height="1"></rect>
                      <rect x="11" y="10" width="1" height="1"></rect>
                      <rect x="12" y="10" width="1" height="1"></rect>
                      <rect x="15" y="10" width="1" height="1"></rect>
                      <rect x="16" y="10" width="1" height="1"></rect>
                      <rect x="17" y="10" width="1" height="1"></rect>
                      <rect x="18" y="10" width="1" height="1"></rect>
                      <rect x="19" y="10" width="1" height="1"></rect>
                      <rect x="24" y="10" width="1" height="1"></rect>
                      <rect x="0" y="11" width="1" height="1"></rect>
                      <rect x="1" y="11" width="1" height="1"></rect>
                      <rect x="2" y="11" width="1" height="1"></rect>
                      <rect x="4" y="11" width="1" height="1"></rect>
                      <rect x="5" y="11" width="1" height="1"></rect>
                      <rect x="8" y="11" width="1" height="1"></rect>
                      <rect x="10" y="11" width="1" height="1"></rect>
                      <rect x="15" y="11" width="1" height="1"></rect>
                      <rect x="16" y="11" width="1" height="1"></rect>
                      <rect x="17" y="11" width="1" height="1"></rect>
                      <rect x="21" y="11" width="1" height="1"></rect>
                      <rect x="22" y="11" width="1" height="1"></rect>
                      <rect x="4" y="12" width="1" height="1"></rect>
                      <rect x="6" y="12" width="1" height="1"></rect>
                      <rect x="7" y="12" width="1" height="1"></rect>
                      <rect x="8" y="12" width="1" height="1"></rect>
                      <rect x="9" y="12" width="1" height="1"></rect>
                      <rect x="10" y="12" width="1" height="1"></rect>
                      <rect x="13" y="12" width="1" height="1"></rect>
                      <rect x="17" y="12" width="1" height="1"></rect>
                      <rect x="18" y="12" width="1" height="1"></rect>
                      <rect x="19" y="12" width="1" height="1"></rect>
                      <rect x="20" y="12" width="1" height="1"></rect>
                      <rect x="21" y="12" width="1" height="1"></rect>
                      <rect x="3" y="13" width="1" height="1"></rect>
                      <rect x="9" y="13" width="1" height="1"></rect>
                      <rect x="11" y="13" width="1" height="1"></rect>
                      <rect x="14" y="13" width="1" height="1"></rect>
                      <rect x="15" y="13" width="1" height="1"></rect>
                      <rect x="18" y="13" width="1" height="1"></rect>
                      <rect x="19" y="13" width="1" height="1"></rect>
                      <rect x="20" y="13" width="1" height="1"></rect>
                      <rect x="23" y="13" width="1" height="1"></rect>
                      <rect x="2" y="14" width="1" height="1"></rect>
                      <rect x="4" y="14" width="1" height="1"></rect>
                      <rect x="5" y="14" width="1" height="1"></rect>
                      <rect x="10" y="14" width="1" height="1"></rect>
                      <rect x="13" y="14" width="1" height="1"></rect>
                      <rect x="14" y="14" width="1" height="1"></rect>
                      <rect x="15" y="14" width="1" height="1"></rect>
                      <rect x="16" y="14" width="1" height="1"></rect>
                      <rect x="18" y="14" width="1" height="1"></rect>
                      <rect x="19" y="14" width="1" height="1"></rect>
                      <rect x="20" y="14" width="1" height="1"></rect>
                      <rect x="22" y="14" width="1" height="1"></rect>
                      <rect x="23" y="14" width="1" height="1"></rect>
                      <rect x="1" y="15" width="1" height="1"></rect>
                      <rect x="6" y="15" width="1" height="1"></rect>
                      <rect x="7" y="15" width="1" height="1"></rect>
                      <rect x="8" y="15" width="1" height="1"></rect>
                      <rect x="9" y="15" width="1" height="1"></rect>
                      <rect x="11" y="15" width="1" height="1"></rect>
                      <rect x="15" y="15" width="1" height="1"></rect>
                      <rect x="19" y="15" width="1" height="1"></rect>
                      <rect x="21" y="15" width="1" height="1"></rect>
                      <rect x="22" y="15" width="1" height="1"></rect>
                      <rect x="3" y="16" width="1" height="1"></rect>
                      <rect x="8" y="16" width="1" height="1"></rect>
                      <rect x="15" y="16" width="1" height="1"></rect>
                      <rect x="19" y="16" width="1" height="1"></rect>
                      <rect x="20" y="16" width="1" height="1"></rect>
                      <rect x="21" y="16" width="1" height="1"></rect>
                      <rect x="22" y="16" width="1" height="1"></rect>
                      <rect x="23" y="16" width="1" height="1"></rect>
                      <rect x="24" y="16" width="1" height="1"></rect>
                      <rect x="11" y="17" width="1" height="1"></rect>
                      <rect x="14" y="17" width="1" height="1"></rect>
                      <rect x="17" y="17" width="1" height="1"></rect>
                      <rect x="19" y="17" width="1" height="1"></rect>
                      <rect x="23" y="17" width="1" height="1"></rect>
                      <rect x="24" y="17" width="1" height="1"></rect>
                      <rect x="9" y="18" width="1" height="1"></rect>
                      <rect x="10" y="18" width="1" height="1"></rect>
                      <rect x="11" y="18" width="1" height="1"></rect>
                      <rect x="13" y="18" width="1" height="1"></rect>
                      <rect x="15" y="18" width="1" height="1"></rect>
                      <rect x="16" y="18" width="1" height="1"></rect>
                      <rect x="17" y="18" width="1" height="1"></rect>
                      <rect x="20" y="18" width="1" height="1"></rect>
                      <rect x="24" y="18" width="1" height="1"></rect>
                      <rect x="8" y="19" width="1" height="1"></rect>
                      <rect x="9" y="19" width="1" height="1"></rect>
                      <rect x="11" y="19" width="1" height="1"></rect>
                      <rect x="12" y="19" width="1" height="1"></rect>
                      <rect x="13" y="19" width="1" height="1"></rect>
                      <rect x="16" y="19" width="1" height="1"></rect>
                      <rect x="17" y="19" width="1" height="1"></rect>
                      <rect x="21" y="19" width="1" height="1"></rect>
                      <rect x="22" y="19" width="1" height="1"></rect>
                      <rect x="24" y="19" width="1" height="1"></rect>
                      <rect x="8" y="20" width="1" height="1"></rect>
                      <rect x="12" y="20" width="1" height="1"></rect>
                      <rect x="14" y="20" width="1" height="1"></rect>
                      <rect x="16" y="20" width="1" height="1"></rect>
                      <rect x="17" y="20" width="1" height="1"></rect>
                      <rect x="20" y="20" width="1" height="1"></rect>
                      <rect x="21" y="20" width="1" height="1"></rect>
                      <rect x="23" y="20" width="1" height="1"></rect>
                      <rect x="24" y="20" width="1" height="1"></rect>
                      <rect x="8" y="21" width="1" height="1"></rect>
                      <rect x="9" y="21" width="1" height="1"></rect>
                      <rect x="10" y="21" width="1" height="1"></rect>
                      <rect x="11" y="21" width="1" height="1"></rect>
                      <rect x="12" y="21" width="1" height="1"></rect>
                      <rect x="14" y="21" width="1" height="1"></rect>
                      <rect x="16" y="21" width="1" height="1"></rect>
                      <rect x="17" y="21" width="1" height="1"></rect>
                      <rect x="18" y="21" width="1" height="1"></rect>
                      <rect x="19" y="21" width="1" height="1"></rect>
                      <rect x="20" y="21" width="1" height="1"></rect>
                      <rect x="23" y="21" width="1" height="1"></rect>
                      <rect x="9" y="22" width="1" height="1"></rect>
                      <rect x="11" y="22" width="1" height="1"></rect>
                      <rect x="14" y="22" width="1" height="1"></rect>
                      <rect x="18" y="22" width="1" height="1"></rect>
                      <rect x="22" y="22" width="1" height="1"></rect>
                      <rect x="23" y="22" width="1" height="1"></rect>
                      <rect x="24" y="22" width="1" height="1"></rect>
                      <rect x="8" y="23" width="1" height="1"></rect>
                      <rect x="9" y="23" width="1" height="1"></rect>
                      <rect x="11" y="23" width="1" height="1"></rect>
                      <rect x="12" y="23" width="1" height="1"></rect>
                      <rect x="13" y="23" width="1" height="1"></rect>
                      <rect x="17" y="23" width="1" height="1"></rect>
                      <rect x="18" y="23" width="1" height="1"></rect>
                      <rect x="19" y="23" width="1" height="1"></rect>
                      <rect x="20" y="23" width="1" height="1"></rect>
                      <rect x="21" y="23" width="1" height="1"></rect>
                      <rect x="22" y="23" width="1" height="1"></rect>
                      <rect x="23" y="23" width="1" height="1"></rect>
                      <rect x="10" y="24" width="1" height="1"></rect>
                      <rect x="12" y="24" width="1" height="1"></rect>
                      <rect x="13" y="24" width="1" height="1"></rect>
                      <rect x="14" y="24" width="1" height="1"></rect>
                      <rect x="15" y="24" width="1" height="1"></rect>
                      <rect x="18" y="24" width="1" height="1"></rect>
                      <rect x="20" y="24" width="1" height="1"></rect>
                      <rect x="21" y="24" width="1" height="1"></rect>
                      <rect x="22" y="24" width="1" height="1"></rect>
                      <rect x="23" y="24" width="1" height="1"></rect>
                      <rect x="24" y="24" width="1" height="1"></rect>
                    </svg>
                    <em>
                      {"código ilustrativo"}
                    </em>
                  </span>
                  {"\n              "}
                  <ol>
                    <li>
                      {"Abra o WhatsApp no celular da empresa."}
                    </li>
                    <li>
                      {"Toque em Aparelhos conectados e depois em Conectar aparelho."}
                    </li>
                    <li>
                      {"Aponte a câmera para o código."}
                    </li>
                  </ol>
                </div>
                {"\n          "}
              </>) : null}
              {"\n          "}
              {$v.ixm?.login ? (<>
                <p style={{"margin":"0","fontSize":"14px","lineHeight":"1.55"}}>
                  {__t($v.ixm?.loginTexto)}
                </p>
              </>) : null}
              {"\n          "}
              {$v.ixm?.email ? (<>
                {"\n            "}
                <div style={{"display":"flex","flexDirection":"column","gap":"8px"}}>
                  {__arr($v.ixm?.provedores).map((p, $index) => (<React.Fragment key={$index}>
                    <button className={"ix-prov"} aria-pressed={p?.ativo} onClick={p?.escolher}>
                      <img src={p?.logo} alt="" width="20" height="20" />
                      {__t(p?.nome)}
                    </button>
                  </React.Fragment>))}
                </div>
                {"\n          "}
              </>) : null}
              {"\n          "}
              <div className={"oa-box"} style={{"gap":"6px"}}>
                <span className={"cad-label"}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="10.5" width="14" height="10" rx="2.5"></rect>
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"></path>
                  </svg>
                  {"O que a Althius pode ver"}
                </span>
                <span style={{"fontSize":"13px","lineHeight":"1.5","color":"var(--text-2)"}}>
                  {"Só conversas com contatos do CRM. Grupos e conversas pessoais ficam de fora. Você desconecta quando quiser."}
                </span>
              </div>
              {"\n          "}
              <div style={{"display":"flex","justifyContent":"flex-end","gap":"8px"}}>
                <button className={"b-sec mini-btn"} style={{"height":"40px"}} onClick={$v.ixm?.fechar}>
                  {"Cancelar"}
                </button>
                <button className={"b-pri cfg-salvar"} onClick={$v.ixm?.confirmar} disabled={$v.ixm?.ocupado}>
                  {__t($v.ixm?.botao)}
                </button>
              </div>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n    "}
        {$v.copAberto ? (<>
          {"\n      "}
          <div onClick={$v.fecharCopiloto} style={__css(`position: fixed; inset: 0; z-index: 80; background: var(--veil); opacity: ${__s($v.cop?.veu)}; transition: opacity 0.2s ease-out;`)}></div>
          {"\n      "}
          <aside className={"cop"} role="dialog" aria-label="Copiloto de Receita" data-arrastando={$v.cop?.arrastando} style={__css(`width: ${__s($v.cop?.w)};`)}>
            {"\n        "}
            {$v.cop?.podeRedimensionar ? (<>
              {"\n          "}
              <div className={"cop-alca"} role="separator" aria-orientation="vertical" aria-label="Redimensionar copiloto" aria-valuenow={$v.cop?.pct} aria-valuemin="0" aria-valuemax="100" tabIndex="0" title="Arraste para aumentar · duplo clique alterna tela inteira" onPointerDown={$v.cop?.iniciarArraste} onDoubleClick={$v.cop?.alternarTela} onKeyDown={$v.cop?.teclaAlca}>
                <span></span>
              </div>
              {"\n        "}
            </>) : null}
            {"\n        "}
            <div className={"cop-top"}>
              {"\n          "}
              <span style={{"width":"8px","height":"8px","borderRadius":"50%","background":"#F7054F","flex":"none"}}></span>
              {"\n          "}
              <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column"}}>
                <span style={{"fontSize":"16px","fontWeight":"500","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                  {"Copiloto de Receita"}
                </span>
                <span style={{"fontSize":"12px","color":"var(--graphite)","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                  {__t($v.cop?.tituloAtual)}
                </span>
              </span>
              {"\n          "}
              <button className={"icon-btn cop-btn"} onClick={$v.cop?.alternarHist} aria-pressed={$v.cop?.histAberto} aria-label="Histórico de conversas" title="Histórico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"></path>
                  <path d="M3.5 4.5v4h4"></path>
                  <path d="M12 8v4.5l3 2"></path>
                </svg>
              </button>
              {"\n          "}
              <button className={"icon-btn cop-btn"} onClick={$v.cop?.nova} aria-label="Nova conversa" title="Nova conversa">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h8"></path>
                  <path d="M15.5 4.5l4 4L9 19H5v-4z"></path>
                </svg>
              </button>
              {"\n          "}
              {$v.cop?.podeRedimensionar ? (<>
                <button className={"icon-btn cop-btn"} onClick={$v.cop?.alternarTela} aria-label={$v.cop?.telaRotulo} title={$v.cop?.telaRotulo}>
                  {$v.cop?.cheia ? (<>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"></path>
                    </svg>
                  </>) : null}
                  {$v.cop?.naoCheia ? (<>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"></path>
                    </svg>
                  </>) : null}
                </button>
              </>) : null}
              {"\n          "}
              <button className={"icon-btn cop-btn"} onClick={$v.fecharCopiloto} aria-label="Fechar copiloto" title="Fechar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
              {"\n        "}
            </div>
            {"\n        "}
            <div className={"cop-cols"}>
              {"\n          "}
              {$v.cop?.histVisivel ? (<>
                {"\n            "}
                <nav className={"cop-hist"} aria-label="Conversas anteriores" data-sobreposto={$v.cop?.histSobreposto}>
                  {"\n              "}
                  <label className={"cop-hist-busca"}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5"></circle>
                      <path d="M16 16l4 4"></path>
                    </svg>
                    <input value={__val($v.cop?.histBusca)} onChange={$v.cop?.mudarHistBusca} placeholder="Buscar conversas" aria-label="Buscar conversas" />
                  </label>
                  {"\n              "}
                  <div className={"scroll-area"} style={{"flex":"1 1 auto","overflowY":"auto","padding":"4px 8px 12px"}}>
                    {"\n                "}
                    {__arr($v.cop?.grupos).map((g, $index) => (<React.Fragment key={$index}>
                      {"\n                  "}
                      <span className={"cop-hist-g"}>
                        {__t(g?.nome)}
                      </span>
                      {"\n                  "}
                      {__arr(g?.itens).map((h, $index) => (<React.Fragment key={$index}>
                        {"\n                    "}
                        <div className={"cop-hist-item"} aria-current={h?.atual}>
                          {"\n                      "}
                          <button className={"cop-hist-abrir"} onClick={h?.abrir}>
                            <span className={"cop-hist-t"}>
                              {__t(h?.titulo)}
                            </span>
                            <span className={"cop-hist-m"}>
                              <span className={"cop-dot"} style={__css(`background: ${__s(h?.cor)};`)}></span>
                              {__t(h?.status)}{" · "}{__t(h?.quando)}
                            </span>
                          </button>
                          {"\n                      "}
                          <button className={"icon-btn cop-hist-del"} onClick={h?.apagar} aria-label={`Apagar conversa ${__s(h?.titulo)}`} title="Apagar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"></path>
                            </svg>
                          </button>
                          {"\n                    "}
                        </div>
                        {"\n                  "}
                      </React.Fragment>))}
                      {"\n                "}
                    </React.Fragment>))}
                    {"\n                "}
                    {$v.cop?.histVazio ? (<>
                      <span style={{"display":"block","padding":"16px 8px","fontSize":"13px","color":"var(--graphite)"}}>
                        {"Nenhuma conversa encontrada."}
                      </span>
                    </>) : null}
                    {"\n              "}
                  </div>
                  {"\n            "}
                </nav>
                {"\n          "}
              </>) : null}
              {"\n          "}
              <div className={"cop-main"}>
                {"\n        "}
                <div className={"scroll-area cop-body"} style={{"flex":"1 1 auto","overflowY":"auto","padding":"18px","display":"flex","flexDirection":"column","gap":"16px"}}>
                  {"\n          "}
                  {$v.copInicio ? (<>
                    {"\n            "}
                    <p style={{"margin":"0","fontSize":"15px","color":"var(--text-2)"}}>
                      {"Descreva o objetivo. O copiloto monta o plano, delega aos agentes e pede sua aprovação antes de qualquer ação irreversível."}
                    </p>
                    {"\n            "}
                    <div style={{"display":"flex","flexDirection":"column","gap":"6px"}}>
                      {"\n              "}
                      {__arr($v.exemplos).map((x, $index) => (<React.Fragment key={$index}>
                        {"\n                "}
                        <button className={"b-sec"} onClick={x?.usar} style={{"minHeight":"44px","padding":"8px 12px","border":"1px solid var(--rule)","background":"var(--paper)","fontFamily":"inherit","fontSize":"14px","color":"var(--ink)","cursor":"pointer","textAlign":"left","borderRadius":"10px"}}>
                          {__t(x?.texto)}
                        </button>
                        {"\n              "}
                      </React.Fragment>))}
                      {"\n            "}
                    </div>
                    {"\n          "}
                  </>) : null}
                  {"\n          "}
                  {$v.copAndamento ? (<>
                    {"\n            "}
                    <div className={"msg"} data-align="end">
                      {"\n              "}
                      <span className={"msg-av msg-av-pessoa"}>
                        {__t($v.usuario?.sigla)}
                      </span>
                      {"\n              "}
                      <div className={"msg-body"}>
                        <div className={"bubble bubble-ink"}>
                          {__t($v.copPedidoTxt)}
                        </div>
                        <span className={"msg-foot"}>
                          {"Pedido ao copiloto"}
                        </span>
                      </div>
                      {"\n            "}
                    </div>
                    {"\n            "}
                    <ol className={"tl tl-step"}>
                      {"\n              "}
                      {__arr($v.copEtapas).map((e, $index) => (<React.Fragment key={$index}>
                        {"\n                "}
                        <li className={"tl-item"} data-done={e?.doneAttr} data-state={e?.st}>
                          {"\n                  "}
                          <span className={"tl-ind"}>
                            {e?.rodando ? (<>
                              <svg className={"ld-arc"} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{"--ld-size":"14px"}}>
                                <circle className={"ld-arc-spin"} cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="18 44.8" strokeLinecap="round" strokeWidth="2.5"></circle>
                              </svg>
                            </>) : null}
                            {e?.feito ? (<>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                              </svg>
                            </>) : null}
                            {e?.mostraN ? (<>
                              {__t(e?.n)}
                            </>) : null}
                          </span>
                          <span className={"tl-sep"}></span>
                          {"\n                  "}
                          <div style={{"display":"flex","flexDirection":"column","gap":"6px","minWidth":"0"}}>
                            {"\n                    "}
                            <span style={__css(`font-size: 14px; color: ${__s(e?.corTitulo)}; padding-top: 1px;`)}>
                              {__t(e?.label)}
                            </span>
                            {"\n                    "}
                            {e?.temTexto ? (<>
                              <span style={{"fontSize":"14px","color":"var(--text-2)","textWrap":"pretty"}}>
                                {__t(e?.texto)}
                              </span>
                            </>) : null}
                            {"\n                    "}
                            {e?.temLista ? (<>
                              <div style={{"display":"flex","flexDirection":"column","gap":"3px"}}>
                                {__arr(e?.lista).map((li, $index) => (<React.Fragment key={$index}>
                                  <span style={{"fontSize":"14px","color":"var(--text-2)"}}>
                                    {"— "}{__t(li)}
                                  </span>
                                </React.Fragment>))}
                              </div>
                            </>) : null}
                            {"\n                    "}
                            {e?.temBarra ? (<>
                              <span style={{"height":"4px","background":"var(--rule)"}}>
                                <span style={__css(`display: block; height: 4px; width: ${__s($v.copPct)}; background: var(--ink);`)}></span>
                              </span>
                            </>) : null}
                            {"\n                    "}
                            {e?.aprovacao ? (<>
                              {"\n                      "}
                              <div style={{"display":"flex","gap":"8px","flexWrap":"wrap"}}>
                                {"\n                        "}
                                <button className={"b-pri"} onClick={$v.copAprovar} style={{"minHeight":"44px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                                  {"Aprovar e executar"}
                                </button>
                                {"\n                        "}
                                <button className={"b-sec"} onClick={$v.copReiniciar} style={{"minHeight":"44px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                                  {"Ajustar pedido"}
                                </button>
                                {"\n                      "}
                              </div>
                              {"\n                    "}
                            </>) : null}
                            {"\n                  "}
                          </div>
                          {"\n                "}
                        </li>
                        {"\n              "}
                      </React.Fragment>))}
                      {"\n            "}
                    </ol>
                    {"\n          "}
                  </>) : null}
                  {"\n        "}
                </div>
                {"\n        "}
                <div style={{"flex":"0 0 auto","borderTop":"1px solid var(--rule)","padding":"12px 18px 16px","display":"flex","gap":"8px","alignItems":"flex-end"}}>
                  {"\n          "}
                  <label style={{"flex":"1 1 auto","minWidth":"0"}}>
                    <span style={{"position":"absolute","width":"1px","height":"1px","overflow":"hidden","clip":"rect(0 0 0 0)"}}>
                      {"Pedido ao copiloto"}
                    </span>
                    {"\n            "}
                    <textarea value={__val($v.copTexto)} onChange={$v.mudarCop} onKeyDown={$v.teclaCop} rows="2" placeholder="O que você precisa?" style={{"width":"100%","boxSizing":"border-box","minHeight":"48px","resize":"none","border":"1px solid var(--steel)","padding":"10px 12px","fontFamily":"inherit","fontWeight":"400","fontSize":"14px","color":"var(--ink)","outline":"none","borderRadius":"10px"}}></textarea>
                    {"\n          "}
                  </label>
                  {"\n          "}
                  <button className={"b-pri"} onClick={$v.copEnviar} style={{"flex":"none","height":"48px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                    {"Enviar"}
                  </button>
                  {"\n        "}
                </div>
                {"\n          "}
              </div>
              {"\n        "}
            </div>
            {"\n      "}
          </aside>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.paletaAberta ? (<>
          {"\n      "}
          <div onClick={$v.fecharPaleta} style={{"position":"fixed","inset":"0","zIndex":"90","background":"var(--veil)"}}></div>
          {"\n      "}
          <div role="dialog" aria-label="Comandos" style={{"position":"fixed","zIndex":"91","left":"50%","top":"12vh","transform":"translateX(-50%)","width":"600px","maxWidth":"calc(100vw - 32px)","background":"var(--paper)","border":"1px solid var(--ink)","boxShadow":"0 2px 4px rgba(19,19,19,0.06), 0 14px 18px -12px rgba(19,19,19,0.28)","borderRadius":"14px","overflow":"hidden"}}>
            {"\n        "}
            <input ref={$v.refPaleta} value={__val($v.paletaQ)} onChange={$v.mudarPaleta} placeholder="Ir para página, agente ou ação" aria-label="Buscar comando" style={{"width":"100%","boxSizing":"border-box","height":"56px","padding":"0 18px","border":"none","borderBottom":"1px solid var(--rule)","outline":"none","fontFamily":"inherit","fontWeight":"400","fontSize":"16px","color":"var(--ink)"}} />
            {"\n        "}
            <div role="listbox" style={{"maxHeight":"50vh","overflowY":"auto","padding":"6px"}}>
              {"\n          "}
              {$v.paletaVazia ? (<>
                <div style={{"padding":"16px 12px","fontSize":"14px","color":"var(--graphite)"}}>
                  {"Nada encontrado para “"}{__t($v.paletaQ)}{"”."}
                </div>
              </>) : null}
              {"\n          "}
              {__arr($v.paleta).map((p, $index) => (<React.Fragment key={$index}>
                {"\n            "}
                <button role="option" aria-selected={p?.ativo} onClick={p?.run} style={__css(`width: 100%; min-height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border: none; background: ${__s(p?.bg)}; color: ${__s(p?.cor)}; font-family: inherit; font-size: 14px; cursor: pointer; text-align: left;`)}>
                  {"\n              "}
                  <span style={{"flex":"1 1 auto"}}>
                    {__t(p?.label)}
                  </span>
                  <span style={{"fontSize":"12px","opacity":"0.7"}}>
                    {__t(p?.grupo)}
                  </span>
                  {"\n            "}
                </button>
                {"\n          "}
              </React.Fragment>))}
              {"\n        "}
            </div>
            {"\n        "}
            <div style={{"padding":"8px 14px","borderTop":"1px solid var(--rule)","fontSize":"13px","color":"var(--graphite)","display":"flex","gap":"14px"}}>
              <span>
                {"↑ ↓ navegar"}
              </span>
              <span>
                {"Enter abrir"}
              </span>
              <span>
                {"Esc fechar"}
              </span>
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n\n    "}
        {$v.confirmAberto ? (<>
          {"\n      "}
          <div style={{"position":"fixed","inset":"0","zIndex":"100","background":"rgba(19,19,19,0.45)"}}></div>
          {"\n      "}
          <div role="alertdialog" aria-modal="true" aria-label={$v.confirm?.titulo} style={{"position":"fixed","zIndex":"101","left":"50%","top":"50%","transform":"translate(-50%, -50%)","width":"440px","maxWidth":"calc(100vw - 32px)","background":"var(--paper)","border":"1px solid var(--ink)","padding":"24px","display":"flex","flexDirection":"column","gap":"14px","borderRadius":"14px","overflow":"hidden"}}>
            {"\n        "}
            <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"24px"}}>
              {__t($v.confirm?.titulo)}
            </h2>
            {"\n        "}
            <p style={{"margin":"0","fontSize":"15px","color":"var(--text-2)"}}>
              {__t($v.confirm?.texto)}
            </p>
            {"\n        "}
            <div style={{"display":"flex","gap":"8px","justifyContent":"flex-end","flexWrap":"wrap"}}>
              {"\n          "}
              <button className={"b-sec"} onClick={$v.confirmCancelar} style={{"minHeight":"44px","padding":"0 16px","border":"1px solid var(--steel)","background":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                {"Cancelar"}
              </button>
              {"\n          "}
              <button className={"b-pri"} onClick={$v.confirmOk} style={{"minHeight":"44px","padding":"0 16px","border":"1px solid var(--ink)","background":"var(--ink)","color":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"10px"}}>
                {__t($v.confirm?.rotulo)}
              </button>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </>) : null}
        {"\n  "}
      </>) : null}
    </div>
    </>
  );
}
