import { useEffect, useState, useId } from "react";
import { FloatingLabel, Form, Modal, Button, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import "./TableModal.css";
import { apiErrorMessage } from "../../../lib/errors";
import { ConfirmFooter } from "../../Common/ConfirmFooter";
import { useConfirmDelete } from "../../../lib/useConfirmDelete";

interface TableModalProps {
  shopId: string;
  // "new" to create a table.
  tableId: string;
  show: boolean;
  handleClose: () => void;
}

const TableModal = ({
  shopId,
  tableId,
  show,
  handleClose,
}: TableModalProps) => {
  const formId = useId();
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const selectedTable = shop?.tables.find((table) => table._id === tableId);

  const [name, setName] = useState("");

  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);

  // Each time the dialog opens it starts from the table as saved (an empty
  // name for a new one), not from what was typed last time.
  useEffect(() => {
    if (!show) return;
    setError(null);
    setName(selectedTable?.name ?? "");
  }, [selectedTable, show]);

  // One create at a time: a double tap would otherwise send two.
  const [creating, setCreating] = useState(false);
  // Deleting asks first, in the footer (ConfirmFooter), saying what goes.
  const confirmDelete = useConfirmDelete(show);
  // Saves the name: to the table edited, or as a new table.
  const saveTable = async () => {
    setError(null);
    if (name.trim() === "") {
      setError("Name is required");
      return;
    }
    try {
      if (tableId === "new") await backend.post(`/shops/${shopId}/tables`, { name });
      else await backend.put(`/shops/${shopId}/tables/${tableId}`, { name });
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const createTable = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await saveTable();
    } finally {
      setCreating(false);
    }
  };

  const updateTable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return saveTable();
  };

  const deleteTable = () => {
    setError(null);
    return confirmDelete.run(
      async () => {
        await backend.delete(`/shops/${shopId}/tables/${tableId}`);
        dispatch(fetchShopList());
        handleClose();
      },
      (err) => setError(apiErrorMessage(err))
    );
  };

  return (
    <>
      <Modal
        className="ShopModal"
        show={show}
        onHide={handleClose}
        fullscreen="sm-down"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>Table</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Enter in the name field saves: a rename, or for a new table
              the same as Create. */}
          <Form
            id={formId}
            onSubmit={(e) => {
              if (tableId !== "new") return updateTable(e);
              e.preventDefault();
              void createTable();
            }}
          >
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-name`} label="Name">
                <Form.Control
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FloatingLabel>
            </Form.Group>
            {error && (
              <Alert className="my-2" variant="danger">
                {error}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        {/* Outside the scrolling body, so the actions stay in view however
            long the form is. The submit button reaches the form through its
            form attribute. */}
        {confirmDelete.confirming ? (
          <ConfirmFooter
            // The saved name: that is the table deleted, whatever the form says.
            message={`Delete ${selectedTable ? `table ${selectedTable.name}` : "this table"}? Its QR code will no longer take orders.`}
            confirmLabel="Delete table"
            danger
            busy={confirmDelete.busy}
            onConfirm={deleteTable}
            onCancel={confirmDelete.cancel}
            returnFocus={() => confirmDelete.buttonRef.current}
          />
        ) : (
          <Modal.Footer
            className={tableId !== "new" ? "justify-content-between" : undefined}
          >
            {tableId !== "new" ? (
              <>
                <Button
                  ref={confirmDelete.buttonRef}
                  variant="outline-danger"
                  onClick={confirmDelete.ask}
                >
                  Delete table
                </Button>
                <Button variant="primary" type="submit" form={formId}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={createTable} disabled={creating}>
                Create Table
              </Button>
            )}
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default TableModal;
