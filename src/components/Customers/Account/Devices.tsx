import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, ListGroup, Spinner } from "react-bootstrap";
import backend from "../../../backend/backend";
import { ISession } from "../../../typings/user";
import { dayOf, describeDevice } from "../../../lib/devices";
import { apiStatus } from "../../../lib/errors";

// The devices the account is signed in on, each with a way to sign it out
// from here. The API keeps a session per sign-in (GET /auth/sessions); the one
// asking is marked and can't be signed out from the list, since "Log out"
// below does that. A device signed out here loses its session at its next
// refresh, within fifteen minutes.
const Devices = () => {
  const [sessions, setSessions] = useState<ISession[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [signingOut, setSigningOut] = useState<string | null>(null);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { data } = await backend.get<ISession[]>("/auth/sessions");
      setSessions(data);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  // Once on opening; a sign-out below updates the list itself.
  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async (id: string) => {
    setSignOutFailed(false);
    setSigningOut(id);
    try {
      await backend.delete(`/auth/sessions/${id}`);
      setSessions((list) => list?.filter((s) => s._id !== id) ?? null);
    } catch (err) {
      // Already gone (signed out from another device meanwhile): as good as done.
      if (apiStatus(err) === 404) setSessions((list) => list?.filter((s) => s._id !== id) ?? null);
      else setSignOutFailed(true);
    } finally {
      setSigningOut(null);
    }
  };

  return (
    <section className="Devices text-start mt-4" aria-labelledby="devices-heading">
      <h2 id="devices-heading" className="h5 px-2">
        Devices
      </h2>
      {loadFailed ? (
        <Alert variant="danger" className="d-flex justify-content-between align-items-center">
          Couldn't load your devices.
          <Button variant="outline-danger" size="sm" onClick={load}>
            Retry
          </Button>
        </Alert>
      ) : sessions === null ? (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" role="status">
            <span className="visually-hidden">Loading devices</span>
          </Spinner>
        </div>
      ) : (
        <ListGroup as="ul">
          {sessions.map((s) => (
            <ListGroup.Item as="li" key={s._id} className="d-flex justify-content-between align-items-center gap-2">
              <div>
                <div className="fw-semibold">
                  {describeDevice(s.userAgent)}{" "}
                  {s.current && (
                    <Badge bg="primary" pill>
                      This device
                    </Badge>
                  )}
                </div>
                <small className="text-body-secondary">
                  Signed in {dayOf(s.createdAt)} · last used {dayOf(s.lastUsedAt)}
                </small>
              </div>
              {!s.current && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => signOut(s._id)}
                  disabled={signingOut !== null}
                  aria-label={`Sign out ${describeDevice(s.userAgent)}`}
                >
                  Sign out
                </Button>
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {signOutFailed && (
        <Alert variant="danger" className="mt-2">
          Couldn't sign that device out. Check your connection and try again.
        </Alert>
      )}
    </section>
  );
};

export default Devices;
