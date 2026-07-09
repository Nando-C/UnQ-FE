import { useEffect, useState } from "react";
import axios from "axios";
import { FloatingLabel, Form, Modal, Button, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { ITable } from "../../../typings/shop";
import "./TableModal.css";

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; details?: { message: string }[] }
      | undefined;
    if (data?.details?.length) return data.details.map((d) => d.message).join(", ");
    if (data?.message) return data.message;
  }
  return "Something went wrong, try again";
};

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
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const selectedTable = shop?.tables.find((table) => table._id === tableId);

  const [table, setTable] = useState<ITable>({
    _id: "",
    name: "",
    Qr_Url: "",
  });

  useEffect(() => {
    setTable({
      _id: selectedTable ? selectedTable._id : "",
      name: selectedTable ? selectedTable.name : "",
      Qr_Url: selectedTable ? selectedTable.Qr_Url : "",
    });
  }, [selectedTable]);

  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);

  const createTable = async () => {
    setError(null);
    if (table.name.trim() === "") {
      setError("Name is required");
      return;
    }
    const newTable = {
      name: table.name,
    };
    try {
      await backend.post(`/shops/${shopId}/tables`, newTable);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Modal className="ShopModal" show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Table</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => updateTable(e)}>
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
            {tableId !== "new" ? (
              <Form.Group className="d-flex justify-content-between">
                <Button
                  variant="outline-danger"
                  className="my-2"
                  onClick={deleteTable}
                >
                  Delete Table
                </Button>
                <Button className="my-2" variant="primary" type="submit">
                  Save Changes
                </Button>
              </Form.Group>
            ) : (
              <Form.Group className="d-flex justify-content-end">
                <Button
                  className="my-2"
                  variant="primary"
                  onClick={createTable}
                >
                  Create Table
                </Button>
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default TableModal;
