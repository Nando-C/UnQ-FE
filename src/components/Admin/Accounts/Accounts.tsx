import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Container, FloatingLabel, Form, ListGroup } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IListedUser } from "../../../typings/user";
import { ACCOUNT_ROLES, accountName, accountRoleLabel, createdMessage, shopsLine } from "../../../lib/accounts";
import { dayOf } from "../../../lib/devices";
import { usePageTitle } from "../../../lib/usePageTitle";
import { Loading, LoadFailed } from "../../Common/ScreenStates";
import AccountModal from "./AccountModal";
import NewAccountModal from "./NewAccountModal";
import "./Accounts.css";

const PAGE = 20;

interface Page {
  users: IListedUser[];
  total: number;
  page: number;
  limit: number;
}

// Every account, for an administrator (GET /users): searched by name or email
// and by role, newest first, a page at a time; New account; and each row's
// dialog, where the role is changed and the account deleted. Nothing else
// reads the list, so it lives here.
const Accounts = () => {
  usePageTitle("Accounts");
  const me = useAppSelector(selectUserData);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [accounts, setAccounts] = useState<IListedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  // The rows are lines of text that wrap again when the page's font arrives,
  // moving everything under them: on a first visit the placeholders stay
  // until it has (a moment; nowhere else does a page fill with text this early).
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let on = true;
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (on) setFontsReady(true);
    });
    return () => {
      on = false;
    };
  }, []);
  // A search that changed while a list is shown: the rows stay until the new
  // ones arrive, rather than giving way to placeholders at every keystroke.
  const [updating, setUpdating] = useState(false);
  const [moreStatus, setMoreStatus] = useState<"loading" | "failed" | null>(null);
  // Only the latest request's answer (or failure) counts: searches are typed
  // faster than they are answered.
  const latest = useRef(0);

  const fetchPage = useCallback(
    async (page: number) => {
      const request = ++latest.current;
      const q = query.trim();
      try {
        const { data } = await backend.get<Page>("/users", { params: { ...(q && { q }), ...(role && { role }), page, limit: PAGE } });
        return request === latest.current ? data : null;
      } catch (err) {
        if (request !== latest.current) return null;
        throw err;
      }
    },
    [query, role]
  );

  // The first page: at once on opening and on a role picked, a moment after
  // typing stops in the search box, and again after an account is created.
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((n) => n + 1);
  const lastQuery = useRef(query);
  // Not before it's known who is signed in: the guard shows the page meanwhile,
  // and a list painted before the header arrives would drop when it does.
  const signedIn = !!me._id;
  useEffect(() => {
    if (!signedIn) return;
    const typed = query !== lastQuery.current;
    lastQuery.current = query;
    setMoreStatus(null);
    setUpdating(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchPage(1);
        if (!data) return;
        setAccounts(data.users);
        setTotal(data.total);
        setStatus("ready");
      } catch {
        setStatus("failed");
      } finally {
        setUpdating(false);
      }
    }, typed ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPage, reloads, query, signedIn]);

  const loadMore = async () => {
    setMoreStatus("loading");
    try {
      const data = await fetchPage(Math.floor(accounts.length / PAGE) + 1);
      if (!data) return;
      // An account already listed (one created since the first page) isn't listed twice.
      setAccounts((list) => [...list, ...data.users.filter((u) => !list.some((l) => l._id === u._id))]);
      setTotal(data.total);
      setMoreStatus(null);
    } catch {
      setMoreStatus("failed");
    }
  };

  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [opened, setOpened] = useState<IListedUser | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  // A row changed in its dialog (a new role) shows as the API answered.
  const replace = (account: IListedUser) => {
    setAccounts((list) => list.map((a) => (a._id === account._id ? { ...a, ...account } : a)));
    setOpened((current) => (current?._id === account._id ? { ...current, ...account } : current));
  };
  const removed = (id: string) => {
    setAccounts((list) => list.filter((a) => a._id !== id));
    setTotal((n) => n - 1);
  };

  return (
    <Container className="Accounts">
      <div className="page-head">
        <h1>Accounts</h1>
        <Button onClick={() => setCreating(true)}>New account</Button>
      </div>
      <div className="filters">
        <FloatingLabel controlId="accounts-search" label="Search by name or email">
          <Form.Control type="search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel controlId="accounts-role" label="Role">
          <Form.Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Any role</option>
            {ACCOUNT_ROLES.map((r) => (
              <option key={r} value={r}>
                {accountRoleLabel[r]}
              </option>
            ))}
          </Form.Select>
        </FloatingLabel>
      </div>
      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {status === "failed" ? (
        <LoadFailed message="Couldn't load the accounts." onRetry={reload} />
      ) : status === "loading" || !fontsReady ? (
        <Loading label="Loading the accounts">
          {/* The count line and rows in their shape, so the list doesn't move
              when the accounts arrive. */}
          <p className="text-body-secondary small">
            <span className="placeholder col-2" />
          </p>
          <ListGroup as="ul" className="mb-3">
            {[0, 1, 2].map((n) => (
              <ListGroup.Item as="li" key={n} className="d-flex align-items-center gap-3">
                <span className="account-name flex-grow-1">
                  <span className="placeholder col-4 d-block mb-1" />
                  <span className="placeholder col-7 d-block small" />
                </span>
                <span className="placeholder btn btn-sm btn-outline-primary disabled col-2" />
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Loading>
      ) : (
        <>
          {/* Kept on the page across searches, so the count that changes is
              what a screen reader hears. */}
          <p className="text-body-secondary small" role="status">
            {updating ? "Searching…" : total === 0 ? "No account matches." : `${total} account${total === 1 ? "" : "s"}`}
          </p>
          <ListGroup as="ul" className="mb-3">
            {accounts.map((account) => {
              const name = accountName(account);
              return (
                <ListGroup.Item as="li" key={account._id} className="d-flex align-items-center gap-3">
                  <div className="account-name flex-grow-1">
                    <div className="fw-semibold text-break">
                      {name}
                      {account._id === me._id && <span className="text-body-secondary fw-normal"> (you)</span>}
                    </div>
                    <div className="small text-body-secondary text-break">
                      {account.email} · {accountRoleLabel[account.role as keyof typeof accountRoleLabel] ?? account.role} · {shopsLine(account.shops)} · since{" "}
                      {dayOf(account.createdAt)}
                    </div>
                  </div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => {
                      setOpened(account);
                      setOpen(account._id);
                    }}
                    aria-label={`Manage ${name}`}
                  >
                    Manage
                  </Button>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
          {accounts.length < total && (
            <div className="text-center mb-4">
              <Button variant="outline-primary" onClick={loadMore} disabled={moreStatus === "loading"}>
                {moreStatus === "loading" ? "Loading…" : moreStatus === "failed" ? "Try again" : "Show more"}
              </Button>
            </div>
          )}
        </>
      )}
      <NewAccountModal
        show={creating}
        handleClose={() => setCreating(false)}
        // The new account is the newest, so it heads the list once the search
        // that might hide it is cleared.
        onCreated={(account) => {
          setNotice(createdMessage(account));
          if (query || role) {
            setQuery("");
            setRole("");
          } else {
            reload();
          }
        }}
      />
      <AccountModal
        account={opened}
        selfId={me._id}
        show={open !== null}
        handleClose={() => setOpen(null)}
        onChanged={replace}
        onDeleted={(id) => {
          setOpen(null);
          removed(id);
        }}
      />
    </Container>
  );
};

export default Accounts;
