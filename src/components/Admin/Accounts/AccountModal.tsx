import { useEffect, useId, useState } from "react";
import { Alert, Button, Form, Image, Modal } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import { ACCOUNT_ROLES, accountName, accountRoleLabel, deleteAccountMessage, isAccountRole, shopsLine } from "../../../lib/accounts";
import { dayOf } from "../../../lib/devices";
import { IListedUser, IUser } from "../../../typings/user";
import { ConfirmFooter } from "../../Common/ConfirmFooter";
import { useConfirmDelete } from "../../../lib/useConfirmDelete";

interface AccountModalProps {
  account: IListedUser | undefined;
  selfId: string;
  show: boolean;
  handleClose: () => void;
  // The account as the API answered after a change.
  onChanged: (account: IListedUser) => void;
  onDeleted: (id: string) => void;
}

// One account: who they are, the shops they work at, and what an
// administrator does about them: the role, saved as it is picked, and Delete,
// which asks first in the dialog's own footer. Not on the administrator's own
// account: the API refuses both, so neither is offered.
const AccountModal = ({ account, selfId, show, handleClose, onChanged, onDeleted }: AccountModalProps) => {
  const roleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The role picked while it saves; put back if the API refuses.
  const [picked, setPicked] = useState<string | null>(null);
  const confirmDelete = useConfirmDelete(show);
  useEffect(() => {
    if (!show) return;
    setError(null);
    setPicked(null);
  }, [show]);

  if (!account) return null;
  const self = account._id === selfId;

  const setRole = async (role: string) => {
    setError(null);
    setPicked(role);
    setSaving(true);
    try {
      // The account as it is now, without its shops: those are kept.
      const { data } = await backend.put<IUser>(`/users/${account._id}/role`, { role });
      onChanged({ ...account, ...data });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPicked(null);
      setSaving(false);
    }
  };

  const remove = () => {
    setError(null);
    return confirmDelete.run(
      async () => {
        await backend.delete(`/users/${account._id}`);
        onDeleted(account._id);
      },
      (err) => setError(apiErrorMessage(err))
    );
  };

  return (
    <Modal className="AccountModal" show={show} onHide={handleClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{self ? "You" : accountName(account)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex align-items-center gap-3 mb-3">
          {account.avatar && <Image src={account.avatar} alt="" roundedCircle width={56} height={56} />}
          <div className="text-break">
            <div className="fw-semibold">{accountName(account)}</div>
            <div className="text-body-secondary">{account.email}</div>
          </div>
        </div>
        <dl className="row mb-3">
          <dt className="col-4">Shops</dt>
          <dd className="col-8">{shopsLine(account.shops)}</dd>
          <dt className="col-4">Since</dt>
          <dd className="col-8">{dayOf(account.createdAt)}</dd>
          <dt className="col-4">Signs in</dt>
          <dd className="col-8">{account.hasPassword ? "with a password" : "with Google only"}</dd>
        </dl>
        <Form.Group className="mb-2">
          <Form.Label htmlFor={roleId}>Role</Form.Label>
          <Form.Select
            id={roleId}
            value={picked ?? (isAccountRole(account.role) ? account.role : "")}
            disabled={self || saving}
            onChange={(e) => void setRole(e.target.value)}
          >
            {ACCOUNT_ROLES.map((role) => (
              <option key={role} value={role}>
                {accountRoleLabel[role]}
              </option>
            ))}
          </Form.Select>
          <Form.Text>
            {self
              ? "You can't change your own role."
              : "Saved as picked. A shop manager may create shops; an administrator runs every shop and the accounts, so can't be a member of one."}
          </Form.Text>
        </Form.Group>
        {self && <p className="text-body-secondary mb-0">Another administrator deletes your account.</p>}
        {error && (
          <Alert className="my-2" variant="danger">
            {error}
          </Alert>
        )}
      </Modal.Body>
      {confirmDelete.confirming ? (
        <ConfirmFooter
          message={deleteAccountMessage(account)}
          confirmLabel="Delete account"
          danger
          busy={confirmDelete.busy}
          onConfirm={remove}
          onCancel={confirmDelete.cancel}
          returnFocus={() => confirmDelete.buttonRef.current}
        />
      ) : (
        <Modal.Footer className="justify-content-between">
          {self ? (
            <span />
          ) : (
            <Button ref={confirmDelete.buttonRef} variant="outline-danger" onClick={confirmDelete.ask}>
              Delete account
            </Button>
          )}
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
};

export default AccountModal;
