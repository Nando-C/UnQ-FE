import { useEffect, useRef, useState } from "react";
import { Alert, Button, FloatingLabel, Form, Image, Modal } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import {
  addedByName,
  dayOf,
  firstName,
  handOverMessage,
  mayMakeOwner,
  mayReRole,
  mayRemove,
  memberName,
  reRoleMessage,
  removeMessage,
  rolesFor,
  labelOf,
} from "../../../lib/staff";
import { roleLabel, type RoleOn } from "../../../lib/roles";
import { IStaffMember, MemberRole } from "../../../typings/shop";
import { ConfirmFooter } from "../../Common/ConfirmFooter";

interface MemberModalProps {
  shopId: string;
  shopName: string;
  // The member opened; undefined once they are gone from the list.
  member: IStaffMember | undefined;
  members: IStaffMember[];
  caller: RoleOn;
  selfId: string;
  show: boolean;
  handleClose: () => void;
  // The staff changed (someone removed, the shop handed over).
  onChanged: () => void;
  // The signed-in account left the shop.
  onLeft: () => void;
}

type Step = "remove" | "handOver" | "reRole";

// One member of the shop: who they are and, for whoever may, what can be done
// about them. Each step asks first in the dialog's own footer (ConfirmFooter),
// saying what follows; the API's refusals show as they are.
const MemberModal = ({ shopId, shopName, member, members, caller, selfId, show, handleClose, onChanged, onLeft }: MemberModalProps) => {
  const [asking, setAsking] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const handOverRef = useRef<HTMLButtonElement>(null);
  const reRoleRef = useRef<HTMLButtonElement>(null);
  // The role picked to change to; the member's own is left out of the list.
  const [newRole, setNewRole] = useState<MemberRole | null>(null);
  // Each opening starts afresh: no question pending, no old error, no pick.
  useEffect(() => {
    if (!show) return;
    setAsking(null);
    setError(null);
    setNewRole(null);
  }, [show]);

  if (!member) return null;
  const self = member.userId === selfId;
  const owner = members.find((m) => m.role === "owner");
  const canRemove = mayRemove(caller, member, selfId);
  const canHandOver = mayMakeOwner(caller, member);
  const canReRole = mayReRole(caller, member);
  const roles = rolesFor(caller, member);
  // A pick that the member's own role has since become (the list reloaded under
  // the dialog) falls back to the first on offer.
  const picked = newRole && roles.includes(newRole) ? newRole : roles[0];

  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (err) {
      setError(apiErrorMessage(err));
      setAsking(null);
      // The staff may have changed under this dialog (the API says so with a
      // 409): the list is reloaded either way.
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    run(async () => {
      await backend.delete(`/shops/${shopId}/staff/${member.userId}`);
      handleClose();
      if (self) onLeft();
      else onChanged();
    });
  const handOver = () =>
    run(async () => {
      await backend.put(`/shops/${shopId}/owner`, { userId: member.userId });
      handleClose();
      onChanged();
    });
  // PUT /shops/:shopId/staff/:userId: the API checks the caller may handle
  // both the role held and the one asked for, and refuses the same role again.
  const reRole = () =>
    run(async () => {
      await backend.put(`/shops/${shopId}/staff/${member.userId}`, { role: picked });
      handleClose();
      onChanged();
    });

  // Why a row has nothing to press, when there is a reason worth saying.
  const why =
    member.role === "owner"
      ? "The owner can't be removed: the shop is handed over first."
      : !member.userId
        ? "This account was deleted; its row stays."
        : !canRemove && caller !== undefined
          ? caller === "manager"
            ? "Only the owner removes a manager."
            : "Only a manager changes staff."
          : null;
  const addedBy = addedByName(member, members);

  return (
    <Modal className="MemberModal" show={show} onHide={handleClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{self ? "You" : memberName(member)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex align-items-center gap-3 mb-3">
          <Image className="staff-avatar" src={member.avatar} alt="" roundedCircle />
          <div className="text-break">
            <div className="fw-semibold">{memberName(member)}</div>
            {member.email && <div className="text-body-secondary">{member.email}</div>}
          </div>
        </div>
        <dl className="row mb-0">
          <dt className="col-4">Role</dt>
          <dd className="col-8">{labelOf(member.role)}</dd>
          <dt className="col-4">Since</dt>
          <dd className="col-8">{dayOf(member.since)}</dd>
          {addedBy && (
            <>
              <dt className="col-4">Added by</dt>
              <dd className="col-8">{addedBy}</dd>
            </>
          )}
        </dl>
        {canReRole && (
          <Form.Group className="mt-3">
            <FloatingLabel controlId="member-new-role" label="Change role to">
              <Form.Select value={picked} onChange={(e) => setNewRole(e.target.value as MemberRole)} disabled={busy || asking !== null}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </Form.Select>
            </FloatingLabel>
          </Form.Group>
        )}
        {why && <p className="text-body-secondary mb-0">{why}</p>}
        {error && (
          <Alert className="my-2" variant="danger">
            {error}
          </Alert>
        )}
      </Modal.Body>
      {asking === "remove" ? (
        <ConfirmFooter
          message={removeMessage(member, shopName, self)}
          confirmLabel={self ? "Leave shop" : `Remove ${firstName(member)}`}
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setAsking(null)}
          returnFocus={() => removeRef.current}
        />
      ) : asking === "handOver" ? (
        <ConfirmFooter
          message={handOverMessage(member, shopName, caller, owner)}
          confirmLabel="Make owner"
          busy={busy}
          onConfirm={handOver}
          onCancel={() => setAsking(null)}
          returnFocus={() => handOverRef.current}
        />
      ) : asking === "reRole" && picked ? (
        <ConfirmFooter
          message={reRoleMessage(member, picked, shopName)}
          confirmLabel="Change role"
          busy={busy}
          onConfirm={reRole}
          onCancel={() => setAsking(null)}
          returnFocus={() => reRoleRef.current}
        />
      ) : (
        (canRemove || canHandOver || canReRole) && (
          <Modal.Footer className="justify-content-between">
            {canRemove ? (
              <Button ref={removeRef} variant="outline-danger" onClick={() => setAsking("remove")}>
                {self ? "Leave shop" : "Remove"}
              </Button>
            ) : (
              <span />
            )}
            <span className="d-flex flex-wrap gap-2">
              {canReRole && (
                <Button ref={reRoleRef} variant="outline-primary" onClick={() => setAsking("reRole")}>
                  Change role
                </Button>
              )}
              {canHandOver && (
                <Button ref={handOverRef} variant="primary" onClick={() => setAsking("handOver")}>
                  Make owner
                </Button>
              )}
            </span>
          </Modal.Footer>
        )
      )}
    </Modal>
  );
};

export default MemberModal;
