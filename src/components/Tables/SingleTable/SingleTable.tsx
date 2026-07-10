import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { GrEdit } from "react-icons/gr";
import { useAppSelector } from "../../../redux/app/hooks";
import placeholder from "../../../assets/placeholder.svg";
import TableModal from "../TableModal/TableModal";
import "./SingleTable.css";

interface TableProps {
  tableId: string;
  shopId: string;
}

const SingleTable = ({ tableId, shopId }: TableProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const table = shop?.tables.find((table) => table._id === tableId);

  const defaultCover = placeholder;

  const qrCode = new QRCodeStyling({
    width: 250,
    height: 250,
    image: shop?.cover !== defaultCover ? shop?.cover : "",
    dotsOptions: {
      color: "#4267b2",
      type: "rounded",
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 5,
    },
  });
  const qrRef = useRef<HTMLDivElement>(null);

  // Must append once on mount only; qrCode is a new QRCodeStyling instance
  // every render, so listing it here would re-append the canvas every render.
  useEffect(() => {
    qrCode.append(qrRef.current ?? undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  qrCode.update({ data: table?.Qr_Url });

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <div className="SingleTable text-center">
        <Card>
          <Card.Title className="mt-3">{table?.name}</Card.Title>
          <div ref={qrRef} />
          <Button size={"lg"} onClick={handleShow}>
            <GrEdit />
          </Button>
        </Card>
        <TableModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          tableId={tableId}
        />
      </div>
    </>
  );
};

export default SingleTable;
