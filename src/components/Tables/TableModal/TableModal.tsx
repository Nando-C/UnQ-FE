import { useEffect, useState, useId } from "react";
import { FloatingLabel, Form, Modal, Button, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { ITable } from "../../../typings/shop";
import "./TableModal.css";
import { apiErrorMessage } from "../../../lib/errors";

interface TableModalProps {
  shopId: string;
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
    if (!window.confirm("Delete this table?")) return;
    setError(null);
    try {
      await backend.delete(`/shops/${shopId}/tables/${table._id}`);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
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
          {/* Enter in the name field creates a new table, as Create does;
              it used to send the rename, with no table to rename. */}
          <Form
            id={formId}
            onSubmit={(e) => {
              if (tableId !== "new") return updateTable(e);
              e.preventDefault();
              void createTable();
            }}
          >
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Name">
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
        <Modal.Footer
          className={tableId !== "new" ? "justify-content-between" : undefined}
        >
          {tableId !== "new" ? (
            <>
              <Button variant="outline-danger" onClick={deleteTable}>
                Delete Table
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
      </Modal>
    </>
  );
};

export default TableModal;
