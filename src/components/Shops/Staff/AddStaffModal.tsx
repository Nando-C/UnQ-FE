import { useEffect, useId, useState } from "react";
import { Alert, Button, FloatingLabel, Form, Modal } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import { IStaffMember, MemberRole } from "../../../typings/shop";
import { RoleOn, givable, roleLabel, roleMeaning } from "../../../lib/roles";

interface AddStaffModalProps {
  shopId: string;
  // Who the signed-in account is to the shop: it decides the roles offered.
  caller: RoleOn;
  show: boolean;
  handleClose: () => void;
  // The member added, and whether an account was created for them (201)
  // rather than an existing one attached (200).
  onAdded: (member: IStaffMember, created: boolean) => void;
}

const EMPTY = { email: "", name: "", surname: "", password: "" };

// Adds someone to the shop by email (POST /shops/:shopId/staff), in a role the
// caller may give (lib/roles.ts givable: the owner any but owner, a manager the
// three below). An address with an account attaches it as it is; one without
// gets an account made from the name, surname and first password, which appear
// once the email is typed and which the API ignores for an address it knows.
// The API checks the role too.
const AddStaffModal = ({ shopId, caller, show, handleClose, onAdded }: AddStaffModalProps) => {
  const formId = useId();
  const roles = givable(caller);
  const [fields, setFields] = useState(EMPTY);
  const [role, setRole] = useState<MemberRole | undefined>(roles[0]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Each opening starts from an empty form, not from what was typed last time.
  useEffect(() => {
    if (!show) return;
    setFields(EMPTY);
    setRole(givable(caller)[0]);
    setError(null);
  }, [show, caller]);

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields({ ...fields, [field]: e.target.value });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (fields.email.trim() === "") {
      setError("Email is required");
      return;
    }
    // The account fields go only when filled: the API asks for them when the
    // address is new, and says which are missing.
    const body: Record<string, string> = { email: fields.email.trim(), role: role ?? roles[0] };
    for (const field of ["name", "surname", "password"] as const) {
      if (fields[field].trim()) body[field] = field === "password" ? fields[field] : fields[field].trim();
    }
    setSending(true);
    try {
      const { data, status } = await backend.post<{ member: IStaffMember; created: boolean }>(`/shops/${shopId}/staff`, body);
      onAdded(data.member, status === 201);
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const typed = fields.email.trim() !== "";

  return (
    <Modal className="ShopModal" show={show} onHide={handleClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Add staff</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} onSubmit={submit}>
          <Form.Group className="mb-3">
            <FloatingLabel controlId={`${formId}-email`} label="Email">
              <Form.Control type="email" placeholder="Email" autoComplete="off" value={fields.email} onChange={set("email")} />
            </FloatingLabel>
            <Form.Text>An address that already has an account is added as it is.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <FloatingLabel controlId={`${formId}-role`} label="Role">
              <Form.Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </Form.Select>
            </FloatingLabel>
            {role && <Form.Text>{roleMeaning[role]}.</Form.Text>}
          </Form.Group>
          {typed && (
            <fieldset className="mb-3">
              <legend className="fs-6 text-body-secondary">For a new account</legend>
              <Form.Text as="p" className="mb-2">
                If the address has no account yet, one is made with these; if it has, they are ignored.
              </Form.Text>
              <FloatingLabel controlId={`${formId}-name`} label="Name" className="mb-2">
                <Form.Control placeholder="Name" autoComplete="off" value={fields.name} onChange={set("name")} />
              </FloatingLabel>
              <FloatingLabel controlId={`${formId}-surname`} label="Surname" className="mb-2">
                <Form.Control placeholder="Surname" autoComplete="off" value={fields.surname} onChange={set("surname")} />
              </FloatingLabel>
              <FloatingLabel controlId={`${formId}-password`} label="First password">
                <Form.Control
                  type="password"
                  placeholder="First password"
                  autoComplete="new-password"
                  value={fields.password}
                  onChange={set("password")}
                />
              </FloatingLabel>
              <Form.Text>At least 8 characters. Tell them; they change it on their account page.</Form.Text>
            </fieldset>
          )}
          {error && (
            <Alert className="my-2" variant="danger">
              {error}
            </Alert>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit" form={formId} disabled={sending}>
          Add to staff
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddStaffModal;
