/** Shows the ?ok= / ?err= message set by server actions after a redirect. */
export default function Notice({ sp }: { sp: { ok?: string; err?: string } }) {
  if (sp.err) return <div className="notice err" role="alert">{sp.err}</div>;
  if (sp.ok) return <div className="notice ok" role="status">{sp.ok}</div>;
  return null;
}
