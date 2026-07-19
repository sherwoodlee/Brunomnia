export type OAuthAuthorizationStatus = {
  flowId: string;
  requestName: string;
  authorizationUrl: string;
  redirectUrl: string;
};

type OAuthAuthorizationDialogProps = {
  status: OAuthAuthorizationStatus;
  onCancel: () => void;
};

export function OAuthAuthorizationDialog({ status, onCancel }: OAuthAuthorizationDialogProps) {
  return <div className="modal-backdrop oauth-authorization-backdrop" role="presentation">
    <section aria-labelledby="oauth-authorization-title" aria-modal="true" className="modal oauth-authorization-modal" role="dialog">
      <header><div><small>OAuth 2</small><h2 id="oauth-authorization-title">Complete browser authorization</h2></div></header>
      <div className="oauth-authorization-body"><p>Brunomnia is waiting for <strong>{status.requestName}</strong> to redirect back to its local listener.</p><label>Callback URL<code>{status.redirectUrl}</code></label><label>Authorization URL<code>{status.authorizationUrl}</code></label></div>
      <footer><button className="modal-cancel" onClick={onCancel} type="button">Cancel authorization</button></footer>
    </section>
  </div>;
}
