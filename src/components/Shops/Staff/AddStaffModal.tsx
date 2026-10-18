import { useEffect, useId, useState } from "react";
import { Alert, Button, FloatingLabel, Form, Modal } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import { IStaffMember } from "../../../typings/shop";

interface AddStaffModalProps {
  shopId: string;
  show: boolean;
  handleClose: () => void;
  // The member added, and whether an account was created for them (201)
  // rather than an existing one attached (200).
  onAdded: (member: IStaffMember, created: boolean) => void;
}

const EMPTY = { email: "", name: "", surname: "", password: "" };

// Adds a manager to the shop by email (POST /shops/:shopId/staff). An address
// with an account attaches it as it is; one without gets an account made from
// the name, surname and first password, which appear once the email is typed
// and which the API ignores for an address it knows. Only the owner (or an
// administrator) opens this dialog; the API checks too.
const AddStaffModal = ({ shopId, show, handleClose, onAdded }: AddStaffModalProps) => {
  const formId = useId();
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Each opening starts from an empty form, not from what was typed last time.
  useEffect(() => {
    if (!show) return;
    setFields(EMPTY);
    setError(null);
  }, [show]);

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
    const body: Record<string, string> = { email: fields.email.trim(), role: "manager" };
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
            <Form.Text>They join as a manager. An address that already has an account is added as it is.</Form.Text>
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
