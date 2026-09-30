import { useEffect, useState, useId } from "react";
import { FloatingLabel, Form, Modal, Button, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { ITable } from "../../../typings/shop";
import "./TableModal.css";
import { apiErrorMessage } from "../../../lib/errors";
import { ConfirmFooter } from "../../Common/ConfirmFooter";

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

  const [table, setTable] = useState<ITable>({
    _id: "",
    name: "",
    Qr_Url: "",
  });

  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);

  // Each time the dialog opens it starts from the table as saved (an empty
  // name for a new one), not from what was typed last time.
  useEffect(() => {
    if (!show) return;
    setError(null);
    setTable({
      _id: selectedTable ? selectedTable._id : "",
      name: selectedTable ? selectedTable.name : "",
      Qr_Url: selectedTable ? selectedTable.Qr_Url : "",
    });
  }, [selectedTable, show]);

  // One create at a time: a double tap would otherwise send two.
  const [creating, setCreating] = useState(false);
  // Deleting asks first, in the footer (ConfirmFooter), saying what goes. A
  // question left open doesn't greet the next opening of the dialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (show) setConfirmingDelete(false);
  }, [show]);
  const createTable = async () => {
    if (creating) return;
    setError(null);
    if (table.name.trim() === "") {
      setError("Name is required");
      return;
    }
    const newTable = {
      name: table.name,
    };
    setCreating(true);
    try {
      await backend.post(`/shops/${shopId}/tables`, newTable);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const updateTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (table.name.trim() === "") {
      setError("Name is required");
      return;
    }
    try {
      await backend.put(`/shops/${shopId}/tables/${table._id}`, {
        name: table.name,
      });
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const deleteTable = async () => {
    setDeleting(true);
    setError(null);
    try {
      await backend.delete(`/shops/${shopId}/tables/${table._id}`);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
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
                  value={table.name}
                  onChange={(e) => setTable({ ...table, name: e.target.value })}
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
        {confirmingDelete ? (
          <ConfirmFooter
            // The saved name: that is the table deleted, whatever the form says.
            message={`Delete ${selectedTable ? `table ${selectedTable.name}` : "this table"}? Its QR code will no longer take orders.`}
            confirmLabel="Delete table"
            danger
            busy={deleting}
            onConfirm={deleteTable}
            onCancel={() => setConfirmingDelete(false)}
          />
        ) : (
          <Modal.Footer
            className={tableId !== "new" ? "justify-content-between" : undefined}
          >
            {tableId !== "new" ? (
              <>
                <Button variant="outline-danger" onClick={() => setConfirmingDelete(true)}>
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
