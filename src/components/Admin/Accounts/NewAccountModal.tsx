import { useEffect, useId, useState } from "react";
import { Alert, Button, FloatingLabel, Form, Modal } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import { ACCOUNT_ROLES, accountRoleLabel } from "../../../lib/accounts";
import { IUser } from "../../../typings/user";

interface NewAccountModalProps {
  show: boolean;
  handleClose: () => void;
  onCreated: (account: IUser) => void;
}

const EMPTY = { name: "", surname: "", email: "", password: "", role: "customer" };

// Creates an account (POST /users) with a first password the administrator
// tells the person, and any role.
const NewAccountModal = ({ show, handleClose, onCreated }: NewAccountModalProps) => {
  const formId = useId();
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!show) return;
    setFields(EMPTY);
    setError(null);
  }, [show]);

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setFields({ ...fields, [field]: e.target.value });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    // The API checks the same (its details name no field), so the form says
    // what is missing before sending.
    if (!fields.name.trim() || !fields.surname.trim() || !fields.email.trim() || !fields.password) {
      setError("All fields are required");
      return;
    }
    if (fields.password.length < 8) {
      setError("The password needs at least 8 characters");
      return;
    }
    setSending(true);
    try {
      const { data } = await backend.post<IUser>("/users", {
        name: fields.name.trim(),
        surname: fields.surname.trim(),
        email: fields.email.trim(),
        password: fields.password,
        role: fields.role,
      });
      onCreated(data);
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal className="ShopModal" show={show} onHide={handleClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>New account</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} onSubmit={submit}>
          <FloatingLabel controlId={`${formId}-name`} label="Name" className="mb-2">
            <Form.Control placeholder="Name" autoComplete="off" value={fields.name} onChange={set("name")} />
          </FloatingLabel>
          <FloatingLabel controlId={`${formId}-surname`} label="Surname" className="mb-2">
            <Form.Control placeholder="Surname" autoComplete="off" value={fields.surname} onChange={set("surname")} />
          </FloatingLabel>
          <FloatingLabel controlId={`${formId}-email`} label="Email" className="mb-2">
            <Form.Control type="email" placeholder="Email" autoComplete="off" value={fields.email} onChange={set("email")} />
          </FloatingLabel>
          <FloatingLabel controlId={`${formId}-password`} label="First password" className="mb-2">
            <Form.Control
              type="password"
              placeholder="First password"
              autoComplete="new-password"
              value={fields.password}
              onChange={set("password")}
            />
          </FloatingLabel>
          <Form.Text as="p" className="mb-3">
            At least 8 characters. Tell them; they change it on their account page.
          </Form.Text>
          <FloatingLabel controlId={`${formId}-role`} label="Role">
            <Form.Select value={fields.role} onChange={set("role")}>
              {ACCOUNT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {accountRoleLabel[role]}
                </option>
              ))}
            </Form.Select>
          </FloatingLabel>
          <Form.Text>A shop manager may create shops; an administrator runs every shop and the accounts.</Form.Text>
          {error && (
            <Alert className="my-2" variant="danger">
              {error}
            </Alert>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" type="submit" form={formId} disabled={sending}>
          Create account
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewAccountModal;
