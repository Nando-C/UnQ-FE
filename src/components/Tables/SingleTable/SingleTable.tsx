import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { GrEdit } from "react-icons/gr";
import { useAppSelector } from "../../../redux/app/hooks";
import placeholder from "../../../assets/placeholder.svg";
import TableModal from "../TableModal/TableModal";
import TableStatus from "../TableStatus/TableStatus";
import TableSheet from "../TableSheet/TableSheet";
import { ITableStatus } from "../../../typings/tables";
import "./SingleTable.css";

interface TableProps {
  tableId: string;
  shopId: string;
  status?: ITableStatus;
  // After the table sheet changed the table, to refresh every card's status.
  onChanged?: () => void;
}

const SingleTable = ({ tableId, shopId, status, onChanged }: TableProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const table = shop?.tables.find((table) => table._id === tableId);

  const defaultCover = placeholder;

  // One QR code for the card's lifetime, drawn again only when what it shows
  // changes (the card re-renders on every status refresh).
  const [qrCode] = useState(() => new QRCodeStyling({
    width: 250,
    height: 250,
    dotsOptions: {
      // The interface teal ($primary, #0F6E66) darkened for scannability. These get
      // printed and stuck on tables, so they have to survive print, dim rooms, odd
      // angles and red-light laser readers. $primary itself would scan (6.10:1, luma
      // 81/255), but this keeps the 10:1 margin the codes had before: 10.10:1 against
      // white, luma 54/255, well clear of the binarisation midpoint, and a red-channel
      // delta of 245, so the modules stay solid in the red band too. Still reads as
      // the brand rather than the generic black.
      color: "#0A4A45",
      type: "rounded",
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 5,
    },
  }));
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    qrCode.append(qrRef.current ?? undefined);
  }, [qrCode]);

  const qrData = table?.Qr_Url;
  const qrImage = shop?.cover !== defaultCover ? shop?.cover : "";
  useEffect(() => {
    qrCode.update({ data: qrData, image: qrImage });
  }, [qrCode, qrData, qrImage]);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <div className="SingleTable text-center h-100">
        <Card className="h-100">
          <Card.Title className="mt-3">{table?.name}</Card.Title>
          {status && <TableStatus status={status} />}
          <div ref={qrRef} className="mt-2" />
          <Button
            variant="outline-primary"
            className="mx-auto mt-auto mb-3 d-print-none"
            onClick={() => setShowSheet(true)}
            aria-label={`View table ${table?.name ?? ""}`.trim()}
          >
            View table
          </Button>
          <Button
            variant="link"
            size="lg"
            className="table-edit d-print-none"
            onClick={handleShow}
            aria-label={`Edit table ${table?.name ?? ""}`.trim()}
          >
            <GrEdit />
          </Button>
        </Card>
        <TableModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          tableId={tableId}
        />
        <TableSheet
          shopId={shopId}
          tableId={tableId}
          tableName={table?.name ?? ""}
          status={status}
          show={showSheet}
          handleClose={() => setShowSheet(false)}
          onChanged={onChanged}
        />
      </div>
    </>
  );
};

export default SingleTable;
