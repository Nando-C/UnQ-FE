import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Image, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IStaffMember } from "../../../typings/shop";
import { addedByName, addedMessage, callerRoleOn, dayOf, manageLabel, memberName, roleLabel, runsStaff } from "../../../lib/staff";
import { Loading, LoadFailed } from "../../Common/ScreenStates";
import AddStaffModal from "./AddStaffModal";
import MemberModal from "./MemberModal";
import "./Staff.css";

interface StaffListProps {
  shopId: string;
}

// A member's key in the list: their account, or, for an account that is gone,
// when they joined.
const keyOf = (member: IStaffMember) => member.userId ?? `gone-${member.since}`;

// The shop's staff: one row per member, the owner first, each opening a dialog
// with what can be done about them (MemberModal); Add staff for the owner (or
// an administrator). The list is the staff route's answer, reloaded after each
// change, as the account's shops are, since who owns and who belongs changed.
const StaffList = ({ shopId }: StaffListProps) => {
  const shop = useAppSelector((state) => state.shops.data.find((shop) => shop._id === shopId));
  const user = useAppSelector(selectUserData);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [members, setMembers] = useState<IStaffMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data } = await backend.get<{ members: IStaffMember[] }>(`/shops/${shopId}/staff`);
      setMembers(data.members);
    } catch {
      setFailed(true);
    }
  }, [shopId]);
  // Once the shop is among the account's (the section shows then): a page
  // opened directly loads them first. Another shop's page starts afresh.
  const known = !!shop;
  useEffect(() => {
    setMembers(null);
    if (known) void load();
  }, [known, load]);
  const changed = () => {
    void load();
    dispatch(fetchShopList());
  };

  const [adding, setAdding] = useState(false);
  // The member whose dialog is open, and the member last opened: kept while
  // the dialog closes (so it fades out showing them) and when a reload finds
  // them gone (so the error that says so is read, not pulled away); a reload
  // that still lists them refreshes what the dialog shows.
  const [open, setOpen] = useState<string | null>(null);
  const [opened, setOpened] = useState<IStaffMember | undefined>();
  useEffect(() => {
    const current = open !== null && members?.find((member) => keyOf(member) === open);
    if (current) setOpened(current);
  }, [members, open]);
  const [notice, setNotice] = useState<string | null>(null);

  // Shown once the account's shops have loaded, like the tables above.
  if (!shop) return null;
  const caller = callerRoleOn(user, shop);

  return (
    <section id="staffList" className="shop-section" aria-labelledby="staff-list-heading">
      <div className="page-head">
        <h2 id="staff-list-heading" className="h5">
          Staff
        </h2>
        <div className="actions">
          {runsStaff(caller) && <Button onClick={() => setAdding(true)}>Add staff</Button>}
        </div>
      </div>
      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {members === null && failed ? (
        <LoadFailed message="Couldn't load the staff." onRetry={() => void load()} />
      ) : members === null ? (
        <Loading label="Loading the staff">
          <ListGroup as="ul" className="StaffList">
            {[0, 1].map((n) => (
              <ListGroup.Item as="li" key={n} className="d-flex align-items-center gap-3">
                <span className="staff-avatar rounded-circle placeholder" />
                <span className="flex-grow-1">
                  <span className="placeholder col-5 d-block mb-1" />
                  <span className="placeholder col-8 d-block" />
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Loading>
      ) : (
        <ListGroup as="ul" className="StaffList">
          {members.map((member) => {
            const addedBy = addedByName(member, members);
            const name = memberName(member);
            return (
              <ListGroup.Item as="li" key={keyOf(member)} className="d-flex align-items-center gap-3">
                <Image className="staff-avatar" src={member.avatar} alt="" roundedCircle />
                <div className="member-name flex-grow-1">
                  <div className="fw-semibold text-break">
                    {name}
                    {member.userId === user._id && <span className="text-body-secondary fw-normal"> (you)</span>}
                  </div>
                  <div className="small text-body-secondary text-break">
                    {member.email && <>{member.email} · </>}
                    {roleLabel[member.role]} · since {dayOf(member.since)}
                    {addedBy && <>, added by {addedBy}</>}
                  </div>
                </div>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    setOpened(member);
                    setOpen(keyOf(member));
                  }}
                  aria-label={manageLabel(member)}
                >
                  Manage
                </Button>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}
      <AddStaffModal
        shopId={shopId}
        show={adding}
        handleClose={() => setAdding(false)}
        onAdded={(member, created) => {
          setNotice(addedMessage(member, created, shop.name));
          changed();
        }}
      />
      <MemberModal
        shopId={shopId}
        shopName={shop.name}
        member={opened}
        members={members ?? []}
        caller={caller}
        selfId={user._id}
        show={open !== null}
        handleClose={() => setOpen(null)}
        onChanged={changed}
        // Having left, the shop is no longer theirs to look at (or to ask
        // the staff of): only the account's shops reload.
        onLeft={() => {
          dispatch(fetchShopList());
          navigate("/");
        }}
      />
    </section>
  );
};

export default StaffList;
